from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS
import pandas as pd
import warnings
from influxdb_client.client.warnings import MissingPivotFunction
import numpy as np
import matplotlib.pyplot as plt

INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "secret_token"
INFLUX_ORG = "my_org"
INFLUX_BUCKET = "network_metrics"

influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)

query_api = influx_client.query_api()

warnings.simplefilter("ignore", MissingPivotFunction)

def fetch_metric_data(measurement: str, field: str, time_range: str = "-12h") -> pd.DataFrame:
    query = f'''
        from(bucket: "{INFLUX_BUCKET}")
          |> range(start: {time_range})
          |> filter(fn: (r) => r["_measurement"] == "{measurement}")
          |> filter(fn: (r) => r["_field"] == "{field}")
          |> drop(columns: ["_start", "_stop"])
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
    '''
    
    result = query_api.query_data_frame(query)
    
    if isinstance(result, list):
        if not result: return pd.DataFrame()
        df = pd.concat(result, ignore_index=True)
    else:
        df = result
        
    if not df.empty:
        df['_time'] = pd.to_datetime(df['_time'])
        
        sort_cols = ['hostname']
        if 'if_name' in df.columns:
            sort_cols.append('if_name')
        sort_cols.append('_time')
        
        df = df.sort_values(by=sort_cols).reset_index(drop=True)
        
        if field in df.columns:
            df = df.rename(columns={field: '_value'})
            
    return df

# 1. Pobieranie CPU
df_cpu = fetch_metric_data(measurement="device_statistics", field="cpu_usage", time_range="-12h")
print("Dane CPU:")
print(df_cpu)

df_memory = fetch_metric_data(measurement="device_statistics", field="memory_usage_pct", time_range="-12h")
print("Dane Pamięci:")
print(df_memory)

# 2. Pobieranie utylizacji wejściowej interfejsów
# (Zauważ, że interfejsy mogą mieć dodatkowy tag, np. 'ifName' lub 'interface', warto to potem uwzględnić w grupowaniu)
df_if_in = fetch_metric_data(measurement="interface_statistics", field="in_util_pct", time_range="-6h")
print("\nDane Interfejsów (IN):")
print(df_if_in)

df_if_out = fetch_metric_data(measurement="interface_statistics", field="out_util_pct", time_range="-6h")
print("\nDane Interfejsów (OUT):")
print(df_if_out)

def detect_anomalies_ewma_cusum(group, span=7, ewma_std=2.5, cusum_k=1.0, cusum_h=5.0):
    # --- 1. EWMA (Spikes / Drops) ---
    # KLUCZOWA ZMIANA: .shift(1) sprawia, że oceniamy punkt na bazie przeszłości, 
    # a nie na bazie go samego!
    group['ewma'] = group['_value'].ewm(span=span).mean().shift(1)
    group['std_dev'] = group['_value'].ewm(span=span).std().shift(1)
    
    # Wypełnienie pustych miejsc po przesunięciu
    group['ewma'] = group['ewma'].bfill().fillna(group['_value'])
    group['std_dev'] = group['std_dev'].bfill().fillna(0)
    
    # Zabezpieczenie przed płaskim ruchem (minimalny margines błędu to chociaż 1%)
    group['std_dev'] = np.where(group['std_dev'] < 1.0, 1.0, group['std_dev'])
    
    group['upper_bound'] = group['ewma'] + (ewma_std * group['std_dev'])
    group['lower_bound'] = group['ewma'] - (ewma_std * group['std_dev'])
    
    group['ewma_anomaly'] = ((group['_value'] > group['upper_bound']) | 
                             (group['_value'] < group['lower_bound'])).astype(int)
    
    # Eliminacja mikro-wahań ("szumu na jałowym biegu")
    MIN_THRESHOLD = 15.0
    group['ewma_anomaly'] = np.where(
        (group['ewma_anomaly'] == 1) & 
        ((group['_value'] > MIN_THRESHOLD) | (group['ewma'] > MIN_THRESHOLD)), 
        1, 0
    )
    
    # Ignorujemy pierwsze 3 pomiary (dajemy algorytmowi czas na złapanie średniej)
    group.iloc[:3, group.columns.get_loc('ewma_anomaly')] = 0
    
    target_mean = group['_value'].rolling(window=10, min_periods=1).mean().shift(1).bfill()
    target_std = group['_value'].rolling(window=10, min_periods=1).std().shift(1).bfill()
    target_std = np.where(target_std < 1.0, 1.0, target_std)
    
    z_scores = (group['_value'] - target_mean) / target_std
    
    sh = np.zeros(len(group))
    sl = np.zeros(len(group))
    z_values = z_scores.values
    
    for i in range(1, len(z_values)):
        sh[i] = max(0, sh[i-1] + z_values[i] - cusum_k)
        sl[i] = min(0, sl[i-1] + z_values[i] + cusum_k)
        
    group['cusum_sh'] = sh
    group['cusum_sl'] = sl
    group['cusum_anomaly'] = ((group['cusum_sh'] > cusum_h) | (group['cusum_sl'] < -cusum_h)).astype(int)
    
    # --- FIX NA COLD START ---
    # Ignorujemy pierwsze 10 punktów dla każdego nowego urządzenia/interfejsu, 
    # żeby algorytm nie świrował przy pierwszym odczycie po starcie skryptu!
    BURN_IN_PERIOD = 10
    if len(group) > BURN_IN_PERIOD:
        group.iloc[:BURN_IN_PERIOD, group.columns.get_loc('cusum_anomaly')] = 0
        group.iloc[:BURN_IN_PERIOD, group.columns.get_loc('ewma_anomaly')] = 0
    else:
        group['cusum_anomaly'] = 0
        group['ewma_anomaly'] = 0
    
    return group

def apply_anomaly_detection(df, group_columns):
    """
    Grupuje DataFrame po podanych kolumnach i aplikuje detekcję anomalii.
    Zabezpiecza przed błędem, gdy DataFrame jest pusty.
    """
    if df is None or df.empty:
        return df
        
    analyzed_groups = []
    for name, group in df.groupby(group_columns):
        analyzed_groups.append(detect_anomalies_ewma_cusum(group.copy()))
        
    return pd.concat(analyzed_groups)


# --- 1. CPU i Pamięć (Grupowanie tylko po hostname) ---

df_cpu = fetch_metric_data(measurement="device_statistics", field="cpu_usage", time_range="-12h")
df_cpu_analyzed = apply_anomaly_detection(df_cpu, group_columns=['hostname'])
print("CPU Anomalie (podgląd):")
print(df_cpu_analyzed[df_cpu_analyzed['ewma_anomaly'] == 1][['hostname', '_time', '_value']])

df_memory = fetch_metric_data(measurement="device_statistics", field="memory_usage_pct", time_range="-12h")
df_memory_analyzed = apply_anomaly_detection(df_memory, group_columns=['hostname'])


# --- 2. Interfejsy (Grupowanie po hostname ORAZ if_name) ---

df_if_in = fetch_metric_data(measurement="interface_statistics", field="in_util_pct", time_range="-12h")
df_if_in_analyzed = apply_anomaly_detection(df_if_in, group_columns=['hostname', 'if_name'])
print("\nInterfejsy IN Anomalie (podgląd):")
if not df_if_in_analyzed.empty:
    print(df_if_in_analyzed[df_if_in_analyzed['ewma_anomaly'] == 1][['hostname', 'if_name', '_time', '_value']])

df_if_out = fetch_metric_data(measurement="interface_statistics", field="out_util_pct", time_range="-12h")
df_if_out_analyzed = apply_anomaly_detection(df_if_out, group_columns=['hostname', 'if_name'])


anomalie_cusum_cpu = df_cpu_analyzed[df_cpu_analyzed['cusum_anomaly'] == 1][['hostname', '_time', '_value', 'cusum_sh', 'cusum_sl']]
print("CUSUM CPU Anomalie:")
print(anomalie_cusum_cpu.to_string())

# Sprawdzamy interfejsy IN
anomalie_cusum_in = df_if_in_analyzed[df_if_in_analyzed['cusum_anomaly'] == 1][['hostname', 'if_name', '_time', '_value', 'cusum_sh', 'cusum_sl']]
print("\nCUSUM Interfejsy IN Anomalie:")
print(anomalie_cusum_in.to_string())

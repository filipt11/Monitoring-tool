import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

df = pd.read_csv('C:/Users/filip.DESKTOP-IVJ9FSO.000/Desktop/query.csv', skiprows=3)
df['_time'] = pd.to_datetime(df['_time'])
df = df.sort_values(by=['hostname', '_time'])

def detect_anomalies_ewma_cusum(group, span=5, ewma_std=1.2, cusum_k=0.5, cusum_h=5.0):
    # --- 1. EWMA (Spikes / Drops) ---
    group['ewma'] = group['_value'].ewm(span=span).mean()
    group['std_dev'] = group['_value'].ewm(span=span).std().fillna(0)
    group['upper_bound'] = group['ewma'] + (ewma_std * group['std_dev'])
    group['lower_bound'] = group['ewma'] - (ewma_std * group['std_dev'])
    
    group['ewma_anomaly'] = ((group['_value'] > group['upper_bound']) | 
                             (group['_value'] < group['lower_bound'])).astype(int)
    
    # --- 2. CUSUM (Sustained Shifts) ---
    # We will track deviation from the EWMA baseline. 
    # Or simpler: deviation from a rolling mean to avoid EWMA adapting too fast to a shift.
    target_mean = group['_value'].rolling(window=10, min_periods=1).mean()
    target_std = group['_value'].rolling(window=10, min_periods=1).std().fillna(1) # prevent div/0
    
    # Z-score normalization for CUSUM
    z_scores = (group['_value'] - target_mean) / target_std
    
    # Initialize CUSUM arrays
    sh = np.zeros(len(group)) # CUSUM High
    sl = np.zeros(len(group)) # CUSUM Low
    
    z_values = z_scores.values
    for i in range(1, len(z_values)):
        sh[i] = max(0, sh[i-1] + z_values[i] - cusum_k)
        sl[i] = min(0, sl[i-1] + z_values[i] + cusum_k)
        
    group['cusum_sh'] = sh
    group['cusum_sl'] = sl
    
    # Flag CUSUM anomalies
    group['cusum_anomaly'] = ((group['cusum_sh'] > cusum_h) | (group['cusum_sl'] < -cusum_h)).astype(int)
    
    return group

df_analyzed = pd.concat([detect_anomalies_ewma_cusum(group.copy()) for name, group in df.groupby('hostname')])

# Let's plot for one device to clearly show CUSUM vs EWMA
host = 'r-avg-1'
host_data = df_analyzed[df_analyzed['hostname'] == host]

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True)

# Plot 1: The signal and EWMA
ax1.plot(host_data['_time'], host_data['_value'], label='CPU Usage', marker='o', color='#2196F3')
ax1.plot(host_data['_time'], host_data['ewma'], label='EWMA', color='green')
ax1.fill_between(host_data['_time'], host_data['lower_bound'], host_data['upper_bound'], color='green', alpha=0.1)

ewma_anom = host_data[host_data['ewma_anomaly'] == 1]
ax1.scatter(ewma_anom['_time'], ewma_anom['_value'], color='red', s=10, label='EWMA Spike/Drop', zorder=5)
ax1.set_title(f'Device: {host} - EWMA (Point Anomalies)')
ax1.legend()
ax1.grid(True, linestyle='--', alpha=0.5)

# Plot 2: CUSUM values
ax2.plot(host_data['_time'], host_data['cusum_sh'], label='CUSUM High (Sustained Increase)', color='orange')
ax2.plot(host_data['_time'], host_data['cusum_sl'], label='CUSUM Low (Sustained Decrease)', color='purple')
ax2.axhline(5.0, color='red', linestyle='--', label='CUSUM Threshold (H)')
ax2.axhline(-5.0, color='red', linestyle='--')

cusum_anom_h = host_data[host_data['cusum_sh'] > 5.0]
cusum_anom_l = host_data[host_data['cusum_sl'] < -5.0]
ax2.scatter(cusum_anom_h['_time'], cusum_anom_h['cusum_sh'], color='red', s=50, zorder=5)
ax2.scatter(cusum_anom_l['_time'], cusum_anom_l['cusum_sl'], color='red', s=50, zorder=5)

ax2.set_title('CUSUM (Level Shift Detection)')
ax2.legend()
ax2.grid(True, linestyle='--', alpha=0.5)

plt.tight_layout()
plt.savefig('cusum_plot.png')
plt.show()
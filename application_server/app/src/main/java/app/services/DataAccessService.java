package app.services;

import app.dtos.data.AvailabilityBucketDto;
import app.dtos.data.DataPointDto;
import app.dtos.data.DeviceAvailabilityDto;
import app.dtos.data.DeviceMetricsDto;
import app.dtos.data.DeviceMetricsSummaryDto;
import app.dtos.data.InterfaceMetricsDto;
import app.dtos.data.InterfaceMetricsSummaryDto;
import com.influxdb.client.InfluxDBClient;
import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DataAccessService {
    private static final Logger log = LoggerFactory.getLogger(DataAccessService.class);
    private static final String TIMESERIES_AGGREGATE_WINDOW =
            "aggregateWindow(every: 5m, fn: last, createEmpty: false, timeSrc: \"_start\")";

    private final InfluxDBClient influxDBClient;

    @Value("${influx.bucket}")
    private String bucket;

    public DataAccessService(InfluxDBClient influxDBClient) {
        this.influxDBClient = influxDBClient;
    }

    public List<DeviceMetricsDto> getDeviceMetrics(
            List<String> deviceIds,
            List<String> metrics,
            Instant start,
            Instant end) {

        if (deviceIds == null || deviceIds.isEmpty() || metrics == null || metrics.isEmpty()) {
            return Collections.emptyList();
        }

        String devicesArr = "[\"" + String.join("\", \"", deviceIds) + "\"]";
        String metricsArr = "[\"" + String.join("\", \"", metrics) + "\"]";

        String flux = String.format(
                "from(bucket: \"%s\") " +
                        "|> range(start: %s, stop: %s) " +
                        "|> filter(fn: (r) => contains(value: r.id, set: %s)) " +
                        "|> filter(fn: (r) => contains(value: r._field, set: %s)) " +
                        "|> " + TIMESERIES_AGGREGATE_WINDOW + " " +
                        "|> pivot(rowKey:[\"_time\", \"id\"], columnKey: [\"_field\"], valueColumn: \"_value\")",
                bucket, start.toString(), end.toString(), devicesArr, metricsArr
        );

        List<FluxTable> tables = influxDBClient.getQueryApi().query(flux);

        Map<String, List<DataPointDto>> devicePointsMap = new HashMap<>();

        for (FluxTable table : tables) {
            for (FluxRecord record : table.getRecords()) {
                String deviceId = (String) record.getValueByKey("id");
                Instant timestamp = record.getTime();

                Map<String, Double> dynamicValues = new HashMap<>();

                for (String metric : metrics) {
                    Object rawValue = record.getValueByKey(metric);
                    if (rawValue != null) {
                        dynamicValues.put(metric, ((Number) rawValue).doubleValue());
                    }
                }

                devicePointsMap
                        .computeIfAbsent(deviceId, k -> new ArrayList<>())
                        .add(new DataPointDto(timestamp, dynamicValues));
            }
        }

        return devicePointsMap.entrySet().stream()
                .map(entry -> new DeviceMetricsDto(
                        entry.getKey(),
                        entry.getValue()
                ))
                .collect(Collectors.toList());
    }

    public List<DeviceMetricsSummaryDto> getDeviceMetricsSummary(
            List<String> deviceIds,
            List<String> metrics,
            Instant start,
            Instant end) {

        if (deviceIds == null || deviceIds.isEmpty() || metrics == null || metrics.isEmpty()) {
            return Collections.emptyList();
        }

        String devicesArr = "[\"" + String.join("\", \"", deviceIds) + "\"]";
        String metricsArr = "[\"" + String.join("\", \"", metrics) + "\"]";

        String flux = String.format(
                "from(bucket: \"%s\") " +
                        "|> range(start: %s, stop: %s) " +
                        "|> filter(fn: (r) => contains(value: r.id, set: %s)) " +
                        "|> filter(fn: (r) => contains(value: r._field, set: %s)) " +
                        "|> group(columns: [\"id\", \"_field\"]) " +
                        "|> mean()",
                bucket, start.toString(), end.toString(), devicesArr, metricsArr
        );

        Map<String, Map<String, Double>> valuesByDevice = new HashMap<>();

        for (FluxTable table : influxDBClient.getQueryApi().query(flux)) {
            for (FluxRecord record : table.getRecords()) {
                String deviceId = (String) record.getValueByKey("id");
                String metric = resolveMetricName(record);
                Object rawValue = record.getValue();

                if (deviceId == null || metric == null || !(rawValue instanceof Number number)) {
                    continue;
                }

                valuesByDevice
                        .computeIfAbsent(deviceId, ignored -> new HashMap<>())
                        .put(metric, number.doubleValue());
            }
        }

        return deviceIds.stream()
                .filter(valuesByDevice::containsKey)
                .map(deviceId -> new DeviceMetricsSummaryDto(deviceId, valuesByDevice.get(deviceId)))
                .collect(Collectors.toList());
    }

    public List<InterfaceMetricsSummaryDto> getInterfaceMetricsSummary(
            List<String> interfaces,
            List<String> metrics,
            Instant start,
            Instant end) {

        if (interfaces == null || interfaces.isEmpty() || metrics == null || metrics.isEmpty()) {
            return Collections.emptyList();
        }

        String deviceInterfaceFilter = interfaces.stream()
                .map(pair -> {
                    String[] parts = pair.split(":");
                    return String.format("(r[\"device_id\"] == \"%s\" and r[\"if_index\"] == \"%s\")",
                            parts[0], parts[1]);
                })
                .collect(Collectors.joining(" or "));

        String metricsFilter = metrics.stream()
                .map(metric -> String.format("r[\"_field\"] == \"%s\"", metric))
                .collect(Collectors.joining(" or "));

        String fluxQuery = String.format(
                "from(bucket: \"%s\")\n" +
                        "  |> range(start: %s, stop: %s)\n" +
                        "  |> filter(fn: (r) => r[\"_measurement\"] == \"interface_statistics\")\n" +
                        "  |> filter(fn: (r) => %s)\n" +
                        "  |> filter(fn: (r) => %s)\n" +
                        "  |> group(columns: [\"device_id\", \"if_index\", \"_field\"])\n" +
                        "  |> mean()",
                bucket, start.toString(), end.toString(), deviceInterfaceFilter, metricsFilter
        );

        Map<String, Map<String, Double>> valuesByInterface = new HashMap<>();

        for (FluxTable table : influxDBClient.getQueryApi().query(fluxQuery)) {
            for (FluxRecord record : table.getRecords()) {
                String deviceId = (String) record.getValueByKey("device_id");
                Object ifIndexValue = record.getValueByKey("if_index");
                String metric = resolveMetricName(record);
                Object rawValue = record.getValue();

                if (deviceId == null || ifIndexValue == null || metric == null || !(rawValue instanceof Number number)) {
                    continue;
                }

                String ifIndex = String.valueOf(ifIndexValue);
                String compositeKey = deviceId + ":" + ifIndex;
                valuesByInterface
                        .computeIfAbsent(compositeKey, ignored -> new HashMap<>())
                        .put(metric, number.doubleValue());
            }
        }

        return interfaces.stream()
                .filter(valuesByInterface::containsKey)
                .map(pair -> {
                    String[] parts = pair.split(":");
                    return new InterfaceMetricsSummaryDto(
                            parts[0],
                            parts[1],
                            valuesByInterface.get(pair)
                    );
                })
                .collect(Collectors.toList());
    }

    private String resolveMetricName(FluxRecord record) {
        Object fieldFromColumn = record.getValueByKey("_field");
        if (fieldFromColumn instanceof String fieldName) {
            return fieldName;
        }

        return record.getField();
    }

    public List<DeviceAvailabilityDto> getDeviceAvailability(
            List<String> deviceIds,
            Instant start,
            Instant end) {

        if (deviceIds == null || deviceIds.isEmpty()) {
            return Collections.emptyList();
        }

        Instant normalizedStart = start.truncatedTo(ChronoUnit.HOURS);
        Instant normalizedEnd = end.truncatedTo(ChronoUnit.HOURS);

        String devicesArr = "[\"" + String.join("\", \"", deviceIds) + "\"]";

        String flux = String.format(
                "from(bucket: \"%s\") " +
                        "|> range(start: %s, stop: %s) " +
                        "|> filter(fn: (r) => contains(value: r.id, set: %s)) " +
                        "|> filter(fn: (r) => r._field == \"status\") " +
                        "|> aggregateWindow(every: 1h, fn: min, createEmpty: false, timeSrc: \"_start\")",
                bucket, normalizedStart.toString(), normalizedEnd.toString(), devicesArr
        );

        List<FluxTable> tables = influxDBClient.getQueryApi().query(flux);

        Map<String, List<AvailabilityBucketDto>> bucketsByDevice = new HashMap<>();
        for (String deviceId : deviceIds) {
            bucketsByDevice.put(deviceId, new ArrayList<>());
        }

        for (FluxTable table : tables) {
            for (FluxRecord record : table.getRecords()) {
                String deviceId = (String) record.getValueByKey("id");
                if (deviceId == null || !bucketsByDevice.containsKey(deviceId)) {
                    continue;
                }

                Object rawValue = record.getValue();
                Instant timestamp = record.getTime();
                if (rawValue == null || timestamp == null) {
                    continue;
                }

                double hourlyStatus = ((Number) rawValue).doubleValue();
                String status = hourlyStatus < 1.0 ? "down" : "up";

                bucketsByDevice
                        .computeIfAbsent(deviceId, ignored -> new ArrayList<>())
                        .add(new AvailabilityBucketDto(timestamp, status));
            }
        }

        return deviceIds.stream()
                .map(deviceId -> new DeviceAvailabilityDto(
                        deviceId,
                        bucketsByDevice.getOrDefault(deviceId, Collections.emptyList())
                ))
                .collect(Collectors.toList());
    }

    public List<InterfaceMetricsDto> getInterfaceMetrics(
            List<String> interfaces,
            List<String> metrics,
            Instant start,
            Instant end) {

        if (interfaces == null || interfaces.isEmpty() || metrics == null || metrics.isEmpty()) {
            return Collections.emptyList();
        }

        String deviceInterfaceFilter = interfaces.stream()
                .map(pair -> {
                    String[] parts = pair.split(":");
                    return String.format("(r[\"device_id\"] == \"%s\" and r[\"if_index\"] == \"%s\")",
                            parts[0], parts[1]);
                })
                .collect(Collectors.joining(" or "));

        String metricsFilter = metrics.stream()
                .map(m -> String.format("r[\"_field\"] == \"%s\"", m))
                .collect(Collectors.joining(" or "));

        String fluxQuery = String.format(
                "from(bucket: \"%s\")\n" +
                        "  |> range(start: %s, stop: %s)\n" +
                        "  |> filter(fn: (r) => r[\"_measurement\"] == \"interface_statistics\")\n" +
                        "  |> filter(fn: (r) => %s)\n" +
                        "  |> filter(fn: (r) => %s)\n" +
                        "  |> " + TIMESERIES_AGGREGATE_WINDOW + "\n" +
                        "  |> pivot(rowKey:[\"_time\", \"device_id\", \"if_index\"], columnKey: [\"_field\"], valueColumn: \"_value\")",
                bucket, start.toString(), end.toString(), deviceInterfaceFilter, metricsFilter
        );

        List<FluxTable> tables = influxDBClient.getQueryApi().query(fluxQuery);

        Map<String, List<DataPointDto>> groupedData = new HashMap<>();

        for (FluxTable table : tables) {
            for (FluxRecord record : table.getRecords()) {
                String deviceId = (String) record.getValueByKey("device_id");
                String ifIndex = (String) record.getValueByKey("if_index");
                String compositeKey = deviceId + "_" + ifIndex;

                Instant timestamp = record.getTime();
                Map<String, Double> valuesMap = new HashMap<>();

                for (String metric : metrics) {
                    Object val = record.getValueByKey(metric);
                    if (val instanceof Number number) {
                        valuesMap.put(metric, number.doubleValue());
                    }
                }

                groupedData.computeIfAbsent(compositeKey, k -> new ArrayList<>())
                        .add(new DataPointDto(timestamp, valuesMap));
            }
        }

        return groupedData.entrySet().stream()
                .map(entry -> {
                    String[] parts = entry.getKey().split("_");
                    return new InterfaceMetricsDto(parts[0], parts[1], entry.getValue());
                })
                .collect(Collectors.toList());
    }
}
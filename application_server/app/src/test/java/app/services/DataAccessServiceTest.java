package app.services;

import app.dtos.data.AvailabilityBucketDto;
import app.dtos.data.DataPointDto;
import app.dtos.data.DeviceAvailabilityDto;
import app.dtos.data.DeviceMetricsDto;
import app.dtos.data.DeviceMetricsSummaryDto;
import app.dtos.data.InterfaceMetricsDto;
import app.dtos.data.InterfaceMetricsSummaryDto;
import com.influxdb.client.InfluxDBClient;
import com.influxdb.client.QueryApi;
import com.influxdb.query.FluxRecord;
import com.influxdb.query.FluxTable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataAccessServiceTest {

    @Mock
    private InfluxDBClient influxDBClient;

    @Mock
    private QueryApi queryApi;

    @InjectMocks
    private DataAccessService dataAccessService;

    private Instant start;
    private Instant end;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(dataAccessService, "bucket", "monitoring-bucket");
        start = Instant.parse("2026-01-01T10:30:00Z");
        end = Instant.parse("2026-01-01T18:30:00Z");
    }

    @Test
    void getDeviceMetrics_shouldReturnEmptyList_whenDeviceIdsOrMetricsAreMissing() {
        assertThat(dataAccessService.getDeviceMetrics(null, List.of("cpu_pct"), start, end)).isEmpty();
        assertThat(dataAccessService.getDeviceMetrics(List.of("1"), null, start, end)).isEmpty();
        assertThat(dataAccessService.getDeviceMetrics(List.of(), List.of("cpu_pct"), start, end)).isEmpty();
        assertThat(dataAccessService.getDeviceMetrics(List.of("1"), List.of(), start, end)).isEmpty();

        verifyNoInteractions(influxDBClient);
    }

    @Test
    void getDeviceMetrics_shouldMapInfluxRecordsToDeviceMetrics() {
        Instant timestamp = Instant.parse("2026-01-01T11:00:00Z");
        FluxRecord record = mock(FluxRecord.class);
        when(record.getValueByKey("id")).thenReturn("device-1");
        when(record.getTime()).thenReturn(timestamp);
        when(record.getValueByKey("cpu_pct")).thenReturn(72.5);
        when(record.getValueByKey("mem_pct")).thenReturn(55.0);

        mockQueryResult(List.of(record));

        List<DeviceMetricsDto> result = dataAccessService.getDeviceMetrics(
                List.of("device-1"),
                List.of("cpu_pct", "mem_pct"),
                start,
                end
        );

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().deviceId()).isEqualTo("device-1");
        assertThat(result.getFirst().dataPoints()).containsExactly(
                new DataPointDto(timestamp, java.util.Map.of("cpu_pct", 72.5, "mem_pct", 55.0))
        );
        verify(queryApi).query(anyString());
    }

    @Test
    void getDeviceMetricsSummary_shouldReturnEmptyList_whenInputIsMissing() {
        assertThat(dataAccessService.getDeviceMetricsSummary(null, List.of("cpu_pct"), start, end)).isEmpty();
        assertThat(dataAccessService.getDeviceMetricsSummary(List.of("1"), List.of(), start, end)).isEmpty();

        verifyNoInteractions(influxDBClient);
    }

    @Test
    void getDeviceMetricsSummary_shouldMapMeanValuesUsingFieldColumn() {
        FluxRecord record = mock(FluxRecord.class);
        when(record.getValueByKey("id")).thenReturn("device-1");
        when(record.getValueByKey("_field")).thenReturn("cpu_pct");
        when(record.getValue()).thenReturn(80.0);

        mockQueryResult(List.of(record));

        List<DeviceMetricsSummaryDto> result = dataAccessService.getDeviceMetricsSummary(
                List.of("device-1", "device-2"),
                List.of("cpu_pct"),
                start,
                end
        );

        assertThat(result).containsExactly(
                new DeviceMetricsSummaryDto("device-1", java.util.Map.of("cpu_pct", 80.0))
        );
    }

    @Test
    void getDeviceMetricsSummary_shouldFallbackToRecordField_whenFieldColumnIsMissing() {
        FluxRecord record = mock(FluxRecord.class);
        when(record.getValueByKey("id")).thenReturn("device-1");
        when(record.getValueByKey("_field")).thenReturn(null);
        when(record.getField()).thenReturn("mem_pct");
        when(record.getValue()).thenReturn(63.0);

        mockQueryResult(List.of(record));

        List<DeviceMetricsSummaryDto> result = dataAccessService.getDeviceMetricsSummary(
                List.of("device-1"),
                List.of("mem_pct"),
                start,
                end
        );

        assertThat(result).containsExactly(
                new DeviceMetricsSummaryDto("device-1", java.util.Map.of("mem_pct", 63.0))
        );
    }

    @Test
    void getDeviceMetricsSummary_shouldSkipInvalidRecords() {
        FluxRecord invalidRecord = mock(FluxRecord.class);
        when(invalidRecord.getValueByKey("id")).thenReturn(null);

        FluxRecord validRecord = mock(FluxRecord.class);
        when(validRecord.getValueByKey("id")).thenReturn("device-1");
        when(validRecord.getValueByKey("_field")).thenReturn("cpu_pct");
        when(validRecord.getValue()).thenReturn(90.0);

        mockQueryResult(List.of(invalidRecord, validRecord));

        List<DeviceMetricsSummaryDto> result = dataAccessService.getDeviceMetricsSummary(
                List.of("device-1"),
                List.of("cpu_pct"),
                start,
                end
        );

        assertThat(result).hasSize(1);
    }

    @Test
    void getInterfaceMetricsSummary_shouldReturnEmptyList_whenInputIsMissing() {
        assertThat(dataAccessService.getInterfaceMetricsSummary(null, List.of("in_bps"), start, end)).isEmpty();
        assertThat(dataAccessService.getInterfaceMetricsSummary(List.of("1:2"), List.of(), start, end)).isEmpty();

        verifyNoInteractions(influxDBClient);
    }

    @Test
    void getInterfaceMetricsSummary_shouldMapMeanValuesForRequestedInterfaces() {
        FluxRecord record = mock(FluxRecord.class);
        when(record.getValueByKey("device_id")).thenReturn("10");
        when(record.getValueByKey("if_index")).thenReturn(2);
        when(record.getValueByKey("_field")).thenReturn("in_bps");
        when(record.getValue()).thenReturn(1_000_000.0);

        mockQueryResult(List.of(record));

        List<InterfaceMetricsSummaryDto> result = dataAccessService.getInterfaceMetricsSummary(
                List.of("10:2", "10:3"),
                List.of("in_bps"),
                start,
                end
        );

        assertThat(result).containsExactly(
                new InterfaceMetricsSummaryDto("10", "2", java.util.Map.of("in_bps", 1_000_000.0))
        );
    }

    @Test
    void getDeviceAvailability_shouldReturnEmptyList_whenDeviceIdsAreMissing() {
        assertThat(dataAccessService.getDeviceAvailability(null, start, end)).isEmpty();
        assertThat(dataAccessService.getDeviceAvailability(List.of(), start, end)).isEmpty();

        verifyNoInteractions(influxDBClient);
    }

    @Test
    void getDeviceAvailability_shouldReturnAllDevicesWithUpAndDownBuckets() {
        Instant bucketTime = Instant.parse("2026-01-01T11:00:00Z");

        FluxRecord upRecord = mock(FluxRecord.class);
        when(upRecord.getValueByKey("id")).thenReturn("device-1");
        when(upRecord.getTime()).thenReturn(bucketTime);
        when(upRecord.getValue()).thenReturn(1.0);

        FluxRecord downRecord = mock(FluxRecord.class);
        when(downRecord.getValueByKey("id")).thenReturn("device-1");
        when(downRecord.getTime()).thenReturn(bucketTime.plusSeconds(3600));
        when(downRecord.getValue()).thenReturn(0.0);

        mockQueryResult(List.of(upRecord, downRecord));

        List<DeviceAvailabilityDto> result = dataAccessService.getDeviceAvailability(
                List.of("device-1", "device-2"),
                start,
                end
        );

        assertThat(result).hasSize(2);

        DeviceAvailabilityDto device1 = result.stream()
                .filter(dto -> dto.deviceId().equals("device-1"))
                .findFirst()
                .orElseThrow();
        assertThat(device1.buckets()).containsExactly(
                new AvailabilityBucketDto(bucketTime, "up"),
                new AvailabilityBucketDto(bucketTime.plusSeconds(3600), "down")
        );

        DeviceAvailabilityDto device2 = result.stream()
                .filter(dto -> dto.deviceId().equals("device-2"))
                .findFirst()
                .orElseThrow();
        assertThat(device2.buckets()).isEmpty();
    }

    @Test
    void getInterfaceMetrics_shouldReturnEmptyList_whenInputIsMissing() {
        assertThat(dataAccessService.getInterfaceMetrics(null, List.of("in_bps"), start, end)).isEmpty();
        assertThat(dataAccessService.getInterfaceMetrics(List.of("1:2"), List.of(), start, end)).isEmpty();

        verifyNoInteractions(influxDBClient);
    }

    @Test
    void getInterfaceMetrics_shouldMapInfluxRecordsToInterfaceMetrics() {
        Instant timestamp = Instant.parse("2026-01-01T11:00:00Z");
        FluxRecord record = mock(FluxRecord.class);
        when(record.getValueByKey("device_id")).thenReturn("10");
        when(record.getValueByKey("if_index")).thenReturn("2");
        when(record.getTime()).thenReturn(timestamp);
        when(record.getValueByKey("in_bps")).thenReturn(500_000.0);
        when(record.getValueByKey("out_bps")).thenReturn(250_000.0);

        mockQueryResult(List.of(record));

        List<InterfaceMetricsDto> result = dataAccessService.getInterfaceMetrics(
                List.of("10:2"),
                List.of("in_bps", "out_bps"),
                start,
                end
        );

        assertThat(result).containsExactly(
                new InterfaceMetricsDto(
                        "10",
                        "2",
                        List.of(new DataPointDto(
                                timestamp,
                                java.util.Map.of("in_bps", 500_000.0, "out_bps", 250_000.0)
                        ))
                )
        );
    }

    private void mockQueryResult(List<FluxRecord> records) {
        FluxTable table = mock(FluxTable.class);
        when(table.getRecords()).thenReturn(records);
        when(influxDBClient.getQueryApi()).thenReturn(queryApi);
        when(queryApi.query(anyString())).thenReturn(List.of(table));
    }
}

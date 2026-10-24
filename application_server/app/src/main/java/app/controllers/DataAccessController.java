package app.controllers;

import app.services.AnomalyDetectionService;
import app.services.DataAccessService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
public class DataAccessController {
    private final DataAccessService dataAccessService;
    private final AnomalyDetectionService anomalyDetectionService;

    public DataAccessController(
            DataAccessService dataAccessService,
            AnomalyDetectionService anomalyDetectionService
    ) {
        this.dataAccessService = dataAccessService;
        this.anomalyDetectionService = anomalyDetectionService;
    }

    @GetMapping("/api/data/metrics/devices")
    public ResponseEntity<?> getDeviceMetrics(@RequestParam List<String> deviceIds, @RequestParam List<String> metrics, @RequestParam Instant start, @RequestParam Instant end) {
        return ResponseEntity.ok(dataAccessService.getDeviceMetrics(
                deviceIds,
                metrics,
                start,
                end
        ));
    }

    @GetMapping("/api/data/metrics/devices/summary")
    public ResponseEntity<?> getDeviceMetricsSummary(
            @RequestParam List<String> deviceIds,
            @RequestParam List<String> metrics,
            @RequestParam Instant start,
            @RequestParam Instant end
    ) {
        return ResponseEntity.ok(dataAccessService.getDeviceMetricsSummary(
                deviceIds,
                metrics,
                start,
                end
        ));
    }
    
    @GetMapping("/api/data/metrics/devices/availability")
    public ResponseEntity<?> getDeviceAvailability(
            @RequestParam List<String> deviceIds,
            @RequestParam Instant start,
            @RequestParam Instant end) {
        return ResponseEntity.ok(dataAccessService.getDeviceAvailability(
                deviceIds,
                start,
                end
        ));
    }

    @GetMapping("/api/data/metrics/interfaces")
    public ResponseEntity<?> getInterfaceMetrics(@RequestParam List<String> interfaces, @RequestParam List<String> metrics, @RequestParam Instant start, @RequestParam Instant end) {
        return ResponseEntity.ok(dataAccessService.getInterfaceMetrics(
                interfaces,
                metrics,
                start,
                end
        ));
    }

    @GetMapping("/api/data/metrics/interfaces/summary")
    public ResponseEntity<?> getInterfaceMetricsSummary(
            @RequestParam List<String> interfaces,
            @RequestParam List<String> metrics,
            @RequestParam Instant start,
            @RequestParam Instant end
    ) {
        return ResponseEntity.ok(dataAccessService.getInterfaceMetricsSummary(
                interfaces,
                metrics,
                start,
                end
        ));
    }

    @GetMapping("/api/data/anomalies")
    public ResponseEntity<?> getAnomalies(
            @RequestParam Instant start,
            @RequestParam Instant end,
            @RequestParam(required = false) List<String> metrics,
            @RequestParam(required = false) List<String> detectors,
            @RequestParam(required = false) String hostname,
            @RequestParam(defaultValue = "true") boolean mergeCusumEpisodes
    ) {
        return ResponseEntity.ok(anomalyDetectionService.getAnomalies(
                start,
                end,
                metrics,
                detectors,
                hostname,
                mergeCusumEpisodes
        ));
    }

}

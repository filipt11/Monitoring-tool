package app.controllers;

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

    public DataAccessController(DataAccessService dataAccessService) {
        this.dataAccessService = dataAccessService;
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
    
    @GetMapping("/api/data/metrics/interfaces")
    public ResponseEntity<?> getInterfaceMetrics(@RequestParam List<String> interfaces, @RequestParam List<String> metrics, @RequestParam Instant start, @RequestParam Instant end) {
        return ResponseEntity.ok(dataAccessService.getInterfaceMetrics(
                interfaces,
                metrics,
                start,
                end
        ));
    }

}

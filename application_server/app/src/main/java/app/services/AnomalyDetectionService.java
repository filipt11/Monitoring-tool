package app.services;

import app.dtos.data.AnomaliesResponseDto;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;

@Service
public class AnomalyDetectionService {
    private final RestClient anomalyDetectorRestClient;

    public AnomalyDetectionService(
            @Qualifier("anomalyDetectorRestClient") RestClient anomalyDetectorRestClient
    ) {
        this.anomalyDetectorRestClient = anomalyDetectorRestClient;
    }

    public AnomaliesResponseDto getAnomalies(
            Instant start,
            Instant end,
            List<String> metrics,
            List<String> detectors,
            String hostname,
            boolean mergeCusumEpisodes
    ) {
        return anomalyDetectorRestClient.get()
                .uri(uriBuilder -> {
                    uriBuilder
                            .path("/anomalies")
                            .queryParam("start", start.toString())
                            .queryParam("end", end.toString())
                            .queryParam("merge_cusum_episodes", mergeCusumEpisodes);

                    if (metrics != null) {
                        metrics.forEach(metric -> uriBuilder.queryParam("metrics", metric));
                    }
                    if (detectors != null) {
                        detectors.forEach(detector -> uriBuilder.queryParam("detectors", detector));
                    }
                    if (hostname != null && !hostname.isBlank()) {
                        uriBuilder.queryParam("hostname", hostname.trim());
                    }

                    return uriBuilder.build();
                })
                .retrieve()
                .body(AnomaliesResponseDto.class);
    }
}

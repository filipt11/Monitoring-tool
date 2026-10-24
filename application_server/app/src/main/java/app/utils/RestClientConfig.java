package app.utils;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {
    @Value("${poller.api.url}")
    private String pollerApiUrl;

    @Value("${anomaly.detector.api.url}")
    private String anomalyDetectorApiUrl;

    @Bean
    @Qualifier("pollerRestClient")
    public RestClient pollerRestClient() {
        return RestClient.builder()
                .baseUrl(pollerApiUrl)
                .build();
    }

    @Bean
    @Qualifier("anomalyDetectorRestClient")
    public RestClient anomalyDetectorRestClient() {
        return RestClient.builder()
                .baseUrl(anomalyDetectorApiUrl)
                .build();
    }
}

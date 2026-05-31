package app.utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class RestClientConfig {
    @Value("${poller.api.url}")
    private String aiUrl;

    @Bean
    public RestClient pollerRestClient() {
        return RestClient.builder()
                .baseUrl(aiUrl)
                .build();
    }
}

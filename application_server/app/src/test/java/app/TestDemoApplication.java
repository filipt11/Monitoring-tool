package app;

import org.springframework.boot.SpringApplication;

public class TestDemoApplication {

	public static void main(String[] args) {
		SpringApplication.from(AppApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}

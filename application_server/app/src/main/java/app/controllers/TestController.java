package app.controllers;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {
    @GetMapping("test")
    public String test() {
        return "Application server is ready to work\n";
    }

    @GetMapping("/api/user")
    public String helloUser() {
        return "Hello User";
    }

    @GetMapping("/administration/api/admin")
    public String helloAdmin() {
        return "Hello Admin";
    }

}

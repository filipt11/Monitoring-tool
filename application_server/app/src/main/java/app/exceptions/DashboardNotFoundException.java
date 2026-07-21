package app.exceptions;

public class DashboardNotFoundException extends RuntimeException {
    public DashboardNotFoundException() {
        super("Dashboard not found");
    }
}

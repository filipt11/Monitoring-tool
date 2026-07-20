package app.exceptions;


import app.records.ExceptionMessage;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.InternalAuthenticationServiceException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.servlet.NoHandlerFoundException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidationErrors(MethodArgumentNotValidException ex) {

        Map<String, String> errors = new HashMap<>();

        ex.getBindingResult().getFieldErrors().forEach(error ->
                errors.put(error.getField(), error.getDefaultMessage())
        );

        return ResponseEntity.badRequest().body(errors);
    }

    // 404 - Not Found
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ExceptionMessage> handleNotFound(NoHandlerFoundException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ExceptionMessage("Resource not found", request.getRequestURI()));
    }

    // 400 - Invalid JSON
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ExceptionMessage> handleBadJSON(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ExceptionMessage("Invalid JSON format", request.getRequestURI()));
    }

    // 405 - Method Not Allowed
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ExceptionMessage> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(new ExceptionMessage("Method not allowed", request.getRequestURI()));
    }

    // 409 - Conflict
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ExceptionMessage> handleConflict(DataIntegrityViolationException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ExceptionMessage("Data conflict occurred (e.g., duplicate entry)", request.getRequestURI()));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ExceptionMessage> handleBadCredentials(BadCredentialsException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ExceptionMessage("Invalid username or password", request.getRequestURI()));
    }

    // 500 - Internal Server Error
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ExceptionMessage> handleGeneral(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception: ", request.getRequestURI(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ExceptionMessage("Internal Server Error", request.getRequestURI()));
    }

    @ExceptionHandler(EmailTakenException.class)
    public ResponseEntity<ExceptionMessage> handleEmailTaken(EmailTakenException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(UsernameTakenException.class)
    public ResponseEntity<ExceptionMessage> handleUsernameTaken(UsernameTakenException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ExceptionMessage> handleInvalidRequest(InvalidRequestException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(PasswordsNotMatchingException.class)
    public ResponseEntity<ExceptionMessage> handlePasswordsNotMatching(PasswordsNotMatchingException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(MissingRefreshTokenException.class)
    public ResponseEntity<ExceptionMessage> handleMissingRefreshToken(MissingRefreshTokenException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ExceptionMessage> handleUserNotFound(UserNotFoundException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(IncorrectPasswordException.class)
    public ResponseEntity<ExceptionMessage> handleIncorrectPassword(IncorrectPasswordException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(IllegalOperationException.class)
    public ResponseEntity<ExceptionMessage> handleIllegalOperation(IllegalOperationException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(AccountDisabledException.class)
    public ResponseEntity<ExceptionMessage> handleAccountDisabled(AccountDisabledException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(InternalAuthenticationServiceException.class)
    public ResponseEntity<ExceptionMessage> handleAuthenticationServiceException(InternalAuthenticationServiceException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ExceptionMessage("Authentication failed: " + ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(DeviceNotFoundException.class)
    public ResponseEntity<ExceptionMessage> handleDeviceNotFound(DeviceNotFoundException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(DeviceGroupNotFoundException.class)
    public ResponseEntity<ExceptionMessage> handleDeviceGroupNotFound(DeviceGroupNotFoundException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(DeviceGroupAccessDeniedException.class)
    public ResponseEntity<ExceptionMessage> handleDeviceGroupAccessDenied(DeviceGroupAccessDeniedException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ExceptionMessage(ex.getMessage(), request.getRequestURI()));
    }

    @ExceptionHandler(RestClientResponseException.class)
    public ResponseEntity<ExceptionMessage> handleRestClientError(
            RestClientResponseException ex,
            HttpServletRequest request) {

        String errorMessage = ex.getStatusText();

        try {
            JsonNode jsonNode = objectMapper.readTree(ex.getResponseBodyAsString());
            if (jsonNode.has("detail")) {
                errorMessage = jsonNode.get("detail").asText();
            }
        } catch (Exception e) {
            errorMessage = ex.getResponseBodyAsString();
        }

        ExceptionMessage exceptionMessage = new ExceptionMessage(
                errorMessage,
                request.getRequestURI()
        );

        return ResponseEntity
                .status(ex.getStatusCode())
                .body(exceptionMessage);
    }
}

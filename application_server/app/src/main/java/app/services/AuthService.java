package app.services;

import app.dtos.auth.JwtResponse;
import app.dtos.auth.RegistrationResponse;
import app.dtos.auth.TokenRefreshRequest;
import app.dtos.auth.TokenRefreshResponse;
import app.dtos.myUser.MyUserLoginDto;
import app.dtos.myUser.MyUserRegisterDto;
import app.dtos.myUser.MyUserResponseDto;
import app.entities.MyUser;
import app.entities.RefreshToken;
import app.exceptions.*;
import app.mappers.MyUserMapper;
import app.repositories.MyUserRepository;
import app.security.JwtUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;


@Service
public class AuthService {
    private final PasswordEncoder passwordEncoder;
    private final MyUserRepository myUserRepository;
    private final MyUserMapper myUserMapper;
    private final JwtUtil jwtUtils;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;

    public AuthService(PasswordEncoder passwordEncoder, MyUserRepository myUserRepository, MyUserMapper myUserMapper, JwtUtil jwtUtils, AuthenticationManager authenticationManager, RefreshTokenService refreshTokenService) {
        this.passwordEncoder = passwordEncoder;
        this.myUserRepository = myUserRepository;
        this.myUserMapper = myUserMapper;
        this.jwtUtils = jwtUtils;
        this.authenticationManager = authenticationManager;
        this.refreshTokenService = refreshTokenService;
    }

    public MyUserResponseDto saveUser(MyUserRegisterDto registerDto) {
        if (myUserRepository.existsByUsername(registerDto.username())) {
            throw new UsernameTakenException();
        }

        if (myUserRepository.existsByEmail(registerDto.email())) {
            throw new EmailTakenException();
        }

        if (!registerDto.password().equals(registerDto.password2())) {
            throw new PasswordsNotMatchingException();
        }

        MyUser user = myUserMapper.toEntity(registerDto);

        user.setPassword(passwordEncoder.encode(registerDto.password()));
        user.setRole("ROLE_USER");
        user.setBanned(false);

        MyUser savedUser = myUserRepository.save(user);

        return myUserMapper.toResponseDto(savedUser);
    }

    public RegistrationResponse returnToken(MyUserRegisterDto myUserRegisterDto) {
        MyUserResponseDto userDto = saveUser(myUserRegisterDto);
        String jwt = jwtUtils.generateToken(userDto.username());
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(userDto.id());

        return new RegistrationResponse(jwt, refreshToken.getToken(), userDto);
    }

    public JwtResponse login(MyUserLoginDto loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequest.username(),
                        loginRequest.password()
                )
        );

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String jwt = jwtUtils.generateToken(userDetails.getUsername());
        MyUser user = myUserRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new UserNotFoundException());

        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user.getId());

        return new JwtResponse(jwt, refreshToken.getToken());
    }

    public TokenRefreshResponse refreshTokens(TokenRefreshRequest request) {
        return refreshTokenService.findByToken(request.refreshToken())
                .map(refreshTokenService::verifyExpiration)
                .map(token -> {
                    MyUser user = token.getMyUser();
                    String accessToken = jwtUtils.generateToken(user.getUsername());
                    RefreshToken rotatedToken = refreshTokenService.rotateRefreshToken(token);

                    return new TokenRefreshResponse(accessToken, rotatedToken.getToken());
                })
                .orElseThrow(MissingRefreshTokenException::new);
    }
}

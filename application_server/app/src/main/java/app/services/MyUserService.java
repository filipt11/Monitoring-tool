package app.services;

import app.dtos.myUser.*;
import app.entities.MyUser;
import app.exceptions.*;
import app.mappers.MyUserMapper;
import app.repositories.MyUserRepository;
import app.repositories.RefreshTokenRepository;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MyUserService {
    private final MyUserRepository myUserRepository;
    private final MyUserMapper myUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;

    public MyUserService(MyUserRepository myUserRepository, MyUserMapper myUserMapper, PasswordEncoder passwordEncoder, RefreshTokenRepository refreshTokenRepository) {
        this.myUserRepository = myUserRepository;
        this.myUserMapper = myUserMapper;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    public MyUserResponseDto createUser(MyUserCreateDto dto) {
        if (myUserRepository.existsByUsername(dto.username())) {
            throw new UsernameTakenException();
        }

        if (myUserRepository.existsByEmail(dto.email())) {
            throw new EmailTakenException();
        }

        if (!dto.password().equals(dto.password2())) {
            throw new PasswordsNotMatchingException();
        }

        if (dto.role().equals("admin") || dto.role().equals("user")) {
            MyUser myUser = new MyUser();
            myUser.setUsername(dto.username());
            myUser.setPassword(passwordEncoder.encode(dto.password()));
            myUser.setEmail(dto.email());
            myUser.setBanned(false);
            if (dto.role().equals("admin")) {
                myUser.setRole("ROLE_ADMIN");
            } else {
                myUser.setRole("ROLE_USER");
            }
            myUserRepository.save(myUser);
            MyUserResponseDto response = myUserMapper.toResponseDto(myUser);
            return response;
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role");
        }
    }

    public MyUserResponseDto findUser(Long id) {
        MyUser myUser = myUserRepository.findById(id).orElseThrow(() -> new UserNotFoundException());
        MyUserResponseDto responseDto = myUserMapper.toResponseDto(myUser);
        return responseDto;
    }

    @Transactional
    public MyUserResponseDto editUserEmail(Long id, MyUserEmailUpdateDto dto) {
        MyUser myUser = myUserRepository.findById(id).orElseThrow(() -> new UserNotFoundException());
        if (!dto.email().equals(myUser.getEmail())) {
            if (myUserRepository.existsByEmail(dto.email())) {
                throw new EmailTakenException();
            }
        }
        myUser.setEmail(dto.email());

        MyUserResponseDto responseDto = myUserMapper.toResponseDto(myUser);
        return responseDto;
    }

    @Transactional
    public MyUserResponseDto updatePasswordByAdmin(Long id, MyUserUpdatePasswordByAdminDto dto) {
        MyUser myUser = myUserRepository.findById(id).orElseThrow(() -> new UserNotFoundException());
        myUser.setPassword(passwordEncoder.encode(dto.password()));

        MyUserResponseDto responseDto = myUserMapper.toResponseDto(myUser);
        return responseDto;
    }

    @Transactional
    public MyUserResponseDto updatePasswordByUser(Long id, MyUserUpdatePasswordByUserDto dto) {
        if (!dto.newPassword().equals(dto.newPassword2())) {
            throw new PasswordsNotMatchingException();
        }

        MyUser myUser = myUserRepository.findById(id).orElseThrow(() -> new UserNotFoundException());

        if (!passwordEncoder.matches(dto.currentPassword(), myUser.getPassword())) {
            throw new IncorrectPasswordException();
        }

        myUser.setPassword(passwordEncoder.encode(dto.newPassword()));

        return myUserMapper.toResponseDto(myUser);
    }

    @Transactional
    public void deleteUser(Long id) {
        MyUser myUser = myUserRepository.findById(id).orElseThrow(() -> new UserNotFoundException());

        if (myUser.getUsername().equals("admin")) {
            throw new IllegalOperationException("Cannot delete admin");
        }

        MyUser admin = myUserRepository.findByUsername("admin").orElseThrow(() -> new UserNotFoundException());

        refreshTokenRepository.deleteByMyUser(myUser);

        myUserRepository.delete(myUser);
    }

    public Page<MyUserResponseDto> selectUsers(Pageable pageable) {
        return myUserRepository.findAll(pageable)
                .map(myUserMapper::toDto);
    }

    public Page<MyUserResponseDto> findUsersByUsername(String s, Pageable pageable) {
        return myUserRepository.findByUsernameStartingWithIgnoreCase(s, pageable)
                .map(myUserMapper::toDto);
    }

    @Transactional
    public MyUserResponseDto disableUser(Long id) {
        MyUser myUser = myUserRepository.findById(id).orElseThrow(() -> new UserNotFoundException());
        myUser.setBanned(true);

        refreshTokenRepository.deleteByMyUser(myUser);

        return myUserMapper.toDto(myUser);
    }

    @Transactional
    public MyUserResponseDto enableUser(Long id) {
        MyUser myUser = myUserRepository.findById(id).orElseThrow(() -> new UserNotFoundException());
        myUser.setBanned(false);

        return myUserMapper.toDto(myUser);
    }

}

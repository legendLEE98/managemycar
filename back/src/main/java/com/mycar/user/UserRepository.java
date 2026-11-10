package com.mycar.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByProviderAndEmail(String provider, String email);

    boolean existsByProviderAndEmail(String provider, String email);
}

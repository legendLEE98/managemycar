package com.mycar.vehicle;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "vehicle")
public class Vehicle {
    @Id
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "body_type", nullable = false)
    private BodyType bodyType = BodyType.SEDAN;

    private String make;
    private String model;

    @Column(name = "model_year")
    private Integer modelYear;

    @Column(name = "fuel_type")
    private String fuelType;

    @Column(name = "odometer_km")
    private Integer odometerKm;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    protected Vehicle() {}

    public Long getId() { return id; }
    public BodyType getBodyType() { return bodyType; }
    public void setBodyType(BodyType bodyType) { this.bodyType = bodyType; }
    public String getMake() { return make; }
    public void setMake(String make) { this.make = make; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public Integer getModelYear() { return modelYear; }
    public void setModelYear(Integer modelYear) { this.modelYear = modelYear; }
    public String getFuelType() { return fuelType; }
    public void setFuelType(String fuelType) { this.fuelType = fuelType; }
    public Integer getOdometerKm() { return odometerKm; }
    public void setOdometerKm(Integer odometerKm) { this.odometerKm = odometerKm; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void touch() { this.updatedAt = OffsetDateTime.now(); }
}

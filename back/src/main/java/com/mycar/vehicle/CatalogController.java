package com.mycar.vehicle;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/vehicles")
public class CatalogController {
    private final VehicleCatalog catalog;

    public CatalogController(VehicleCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/stats")
    public VehicleCatalog.Stats stats() {
        return catalog.stats();
    }

    @GetMapping("/search")
    public VehicleCatalog.Result search(@RequestParam("q") String q) {
        return catalog.search(q.length() > 60 ? q.substring(0, 60) : q);
    }
}

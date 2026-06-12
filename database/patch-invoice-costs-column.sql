-- Run in phpMyAdmin if saving vehicles fails with "invoice_costs_json" error.
-- Safe to run once on an existing Tronex database.

ALTER TABLE cars
  ADD COLUMN invoice_costs_json JSON NULL AFTER gradient_color;

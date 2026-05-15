-- Tronex Car Importers — MySQL schema (shared hosting / phpMyAdmin)
-- Run this in your hosting control panel after creating an empty database.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS counters (
  counter_key VARCHAR(50) NOT NULL PRIMARY KEY,
  sequence_value INT UNSIGNED NOT NULL DEFAULT 199
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(50) NOT NULL,
  address VARCHAR(500) NOT NULL DEFAULT '',
  city VARCHAR(100) NOT NULL DEFAULT '',
  country VARCHAR(100) NOT NULL DEFAULT '',
  password VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  customer_id VARCHAR(50) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  profile_json JSON NULL,
  uploads_json JSON NULL,
  account_details_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_customer_id (customer_id),
  KEY idx_users_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cars (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  car_id VARCHAR(80) NOT NULL,
  internal_stock_number VARCHAR(20) NOT NULL,
  external_stock_number VARCHAR(80) NOT NULL DEFAULT '',
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year SMALLINT NOT NULL,
  price DECIMAL(14, 2) NOT NULL,
  availability ENUM('Available', 'Reserved', 'Sold') NOT NULL DEFAULT 'Available',
  type VARCHAR(50) NOT NULL DEFAULT 'Sedan',
  body_type VARCHAR(50) NOT NULL DEFAULT '',
  color VARCHAR(50) NOT NULL,
  interior_color VARCHAR(50) NOT NULL DEFAULT '',
  doors TINYINT UNSIGNED NOT NULL DEFAULT 4,
  seats TINYINT UNSIGNED NOT NULL DEFAULT 5,
  mileage INT UNSIGNED NOT NULL,
  transmission VARCHAR(50) NOT NULL,
  fuel VARCHAR(50) NOT NULL,
  drive VARCHAR(20) NOT NULL DEFAULT '',
  engine_capacity VARCHAR(50) NOT NULL DEFAULT '',
  trunk VARCHAR(50) NOT NULL DEFAULT '',
  registration VARCHAR(50) NOT NULL DEFAULT '',
  description TEXT,
  highlights_json JSON NULL,
  features_json JSON NULL,
  main_image VARCHAR(500) NOT NULL DEFAULT '',
  images_json JSON NULL,
  badge VARCHAR(50) NOT NULL DEFAULT '',
  gradient_color VARCHAR(255) NOT NULL DEFAULT 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  invoice_costs_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cars_car_id (car_id),
  UNIQUE KEY uq_cars_stock (internal_stock_number),
  KEY idx_cars_make (make),
  KEY idx_cars_availability (availability),
  KEY idx_cars_created (created_at),
  KEY idx_cars_badge (badge)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  car_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NULL,
  invoice_number VARCHAR(50) NOT NULL,
  date_issued DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATETIME NOT NULL,
  car_details_json JSON NULL,
  customer_details_json JSON NULL,
  invoice_items_json JSON NULL,
  subtotal DECIMAL(14, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14, 2) NOT NULL DEFAULT 0,
  bank_details_json JSON NULL,
  mpesa_details_json JSON NULL,
  claim_clause TEXT,
  notes TEXT,
  status ENUM('Draft', 'Issued', 'Paid', 'Overdue', 'Cancelled') NOT NULL DEFAULT 'Draft',
  created_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoices_number (invoice_number),
  KEY idx_invoices_car (car_id),
  KEY idx_invoices_customer (customer_id),
  KEY idx_invoices_status (status),
  CONSTRAINT fk_invoices_car FOREIGN KEY (car_id) REFERENCES cars (id) ON DELETE CASCADE,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO counters (counter_key, sequence_value) VALUES ('internalStockNumber', 199);

SET FOREIGN_KEY_CHECKS = 1;

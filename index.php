<?php
declare(strict_types=1);

use Tronex\Auth;
use Tronex\CarRepository;
use Tronex\EmailService;
use Tronex\ImageService;
use Tronex\InvoiceRepository;
use Tronex\PdfService;
use Tronex\UserRepository;

require_once __DIR__ . '/includes/bootstrap.php';

$method = request_method();
$path = request_path();

// ---------- Helpers ----------
function validate_car_payload(array $body): ?array
{
    $year = filter_var($body['year'] ?? null, FILTER_VALIDATE_INT);
    $price = to_finite_number($body['price'] ?? null);
    $mileage = to_finite_number($body['mileage'] ?? null);
    $required = ['make', 'model', 'color', 'description'];
    foreach ($required as $k) {
        if (empty($body[$k])) {
            json_response(['success' => false, 'message' => 'Please provide valid fields: make, model, year, price, mileage, color, description'], 400);
        }
    }
    if ($year === false || !is_finite($price) || !is_finite($mileage)) {
        json_response(['success' => false, 'message' => 'Please provide valid fields: make, model, year, price, mileage, color, description'], 400);
    }
    return [
        'make' => $body['make'],
        'model' => $body['model'],
        'year' => (int) $year,
        'price' => $price,
        'mileage' => (int) $mileage,
        'color' => $body['color'],
        'description' => $body['description'],
        'type' => $body['type'] ?? 'Sedan',
        'bodyType' => $body['bodyType'] ?? '',
        'transmission' => $body['transmission'] ?? 'Automatic',
        'interiorColor' => $body['interiorColor'] ?? '',
        'doors' => $body['doors'] ?? 4,
        'seats' => $body['seats'] ?? 5,
        'fuel' => $body['fuel'] ?? 'Petrol',
        'drive' => $body['drive'] ?? '2WD',
        'engineCapacity' => $body['engineCapacity'] ?? '',
        'trunk' => $body['trunk'] ?? '',
        'registration' => $body['registration'] ?? '',
        'badge' => $body['badge'] ?? 'Featured',
        'availability' => $body['availability'] ?? 'Available',
        'gradientColor' => $body['gradientColor'] ?? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'highlights' => $body['highlights'] ?? [],
        'features' => $body['features'] ?? [],
        'images' => $body['images'] ?? [],
        'mainImage' => $body['mainImage'] ?? '',
        'externalStockNumber' => $body['externalStockNumber'] ?? '',
        'invoiceCosts' => $body['invoiceCosts'] ?? null,
    ];
}

try {
    // ---------- API: Contact ----------
    if ($method === 'POST' && $path === '/api/contact') {
        $body = read_json_body();
        if (empty($body['name']) || empty($body['email']) || empty($body['message'])) {
            json_response(['success' => false, 'message' => 'Please fill in all required fields'], 400);
        }
        json_response(['success' => true, 'message' => 'Thank you for your inquiry! We will get back to you soon.']);
    }

    // ---------- API: Admin login ----------
    if ($method === 'POST' && $path === '/api/admin/login') {
        $body = read_json_body();
        $configured = Tronex\Config::get('ADMIN_PASSWORD');
        if (Tronex\Config::isProduction() && !$configured) {
            json_response(['success' => false, 'message' => 'Admin login is not configured.'], 503);
        }
        $expected = ($configured !== null && $configured !== '') ? $configured : (Tronex\Config::isProduction() ? null : 'admin123');
        if (!$expected || !Auth::secureComparePassword((string) ($body['password'] ?? ''), $expected)) {
            json_response(['success' => false, 'message' => 'Invalid password'], 401);
        }
        json_response(['success' => true, 'message' => 'Login successful', 'token' => Auth::signAdminPanelToken()]);
    }

    if ($method === 'GET' && $path === '/api/admin/session') {
        Auth::requireAdminJson();
        json_response(['success' => true, 'authenticated' => true]);
    }

    // ---------- API: Auth ----------
    if ($method === 'POST' && $path === '/api/auth/register') {
        $body = read_json_body();
        if (empty($body['firstName']) || empty($body['lastName']) || empty($body['email']) || empty($body['mobileNumber']) || empty($body['password'])) {
            json_response(['success' => false, 'message' => 'All required fields must be filled'], 400);
        }
        if (($body['password'] ?? '') !== ($body['passwordConfirm'] ?? '')) {
            json_response(['success' => false, 'message' => 'Passwords do not match'], 400);
        }
        if (UserRepository::findByEmail($body['email'])) {
            json_response(['success' => false, 'message' => 'Email already registered. Please use a different email or login.'], 400);
        }
        $user = UserRepository::create($body);
        $token = Auth::signUserToken((int) $user['id'], $user['email'], $user['role']);
        json_response([
            'success' => true,
            'message' => 'Registration successful! You are now logged in.',
            'token' => $token,
            'user' => public_user($user),
        ]);
    }

    if ($method === 'POST' && $path === '/api/auth/login') {
        $body = read_json_body();
        if (empty($body['email']) || empty($body['password'])) {
            json_response(['success' => false, 'message' => 'Email and password are required'], 400);
        }
        $row = UserRepository::findByEmail($body['email']);
        if (!$row || !UserRepository::verifyPassword($row, $body['password'])) {
            json_response(['success' => false, 'message' => 'Invalid email or password'], 401);
        }
        if (empty($row['isActive'])) {
            json_response(['success' => false, 'message' => 'Your account has been deactivated'], 401);
        }
        unset($row['password']);
        $token = Auth::signUserToken((int) $row['id'], $row['email'], $row['role']);
        json_response(['success' => true, 'message' => 'Login successful!', 'token' => $token, 'user' => public_user($row)]);
    }

    if ($method === 'GET' && $path === '/api/auth/me') {
        $auth = Auth::requireUserJson();
        $user = UserRepository::findById((int) $auth['id']);
        if (!$user) {
            json_response(['success' => false, 'message' => 'User not found'], 404);
        }
        json_response(['success' => true, 'user' => public_user($user)]);
    }

    if ($method === 'PUT' && $path === '/api/auth/update-profile') {
        $auth = Auth::requireUserJson();
        $body = read_json_body();
        $user = UserRepository::updateProfile((int) $auth['id'], $body);
        if (!$user) {
            json_response(['success' => false, 'message' => 'User not found'], 404);
        }
        json_response(['success' => true, 'message' => 'Profile updated successfully', 'user' => public_user($user)]);
    }

    // Profile uploads
    if ($method === 'POST' && str_starts_with($path, '/api/profile/upload')) {
        $auth = Auth::requireUserJson();
        $userId = (int) $auth['id'];

        if ($path === '/api/profile/upload-slot') {
            $slot = trim((string) ($_POST['slot'] ?? ''));
            $paths = UserRepository::uploadSlotPaths();
            if (!isset($paths[$slot])) {
                json_response(['success' => false, 'message' => 'Invalid upload slot'], 400);
            }
            if (empty($_FILES['file'])) {
                json_response(['success' => false, 'message' => 'No file provided'], 400);
            }
            $url = ImageService::handleCustomerUpload($userId, $_FILES['file']);
            UserRepository::applyUploadPath($userId, $paths[$slot], $url);
            json_response(['success' => true, 'data' => ['url' => $url, 'slot' => $slot]]);
        }

        $fieldMap = [
            '/api/profile/upload/passport' => ['profile.passportUrl', 'passport'],
            '/api/profile/upload/consignee' => ['uploads.consigneeDocUrl', 'consignee'],
            '/api/profile/upload/pin' => ['uploads.pinDocUrl', 'pin'],
        ];

        if (isset($fieldMap[$path])) {
            [$dot, $key] = $fieldMap[$path];
            if (empty($_FILES[$key])) {
                json_response(['success' => false, 'message' => 'No file provided'], 400);
            }
            $url = ImageService::handleCustomerUpload($userId, $_FILES[$key]);
            UserRepository::applyUploadPath($userId, $dot, $url);
            json_response(['success' => true, 'data' => ['url' => $url]]);
        }

        if ($path === '/api/profile/upload/bank-slips') {
            if (empty($_FILES['slips'])) {
                json_response(['success' => false, 'message' => 'No files provided'], 400);
            }
            $slips = [];
            $files = $_FILES['slips'];
            $count = is_array($files['name']) ? count($files['name']) : 1;
            for ($i = 0; $i < $count; $i++) {
                $file = is_array($files['name']) ? [
                    'name' => $files['name'][$i],
                    'type' => $files['type'][$i],
                    'tmp_name' => $files['tmp_name'][$i],
                    'error' => $files['error'][$i],
                    'size' => $files['size'][$i],
                ] : $files;
                if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                    continue;
                }
                $url = ImageService::handleCustomerUpload($userId, $file);
                $slips[] = ['url' => $url, 'uploadedAt' => date('c')];
            }
            UserRepository::pushBankSlips($userId, $slips);
            json_response(['success' => true, 'data' => $slips]);
        }
    }

    // ---------- API: Cars (public) ----------
    if ($method === 'GET' && $path === '/api/cars') {
        json_response(['success' => true, 'data' => CarRepository::findAll()]);
    }
    if ($method === 'GET' && $path === '/api/cars/featured') {
        json_response(['success' => true, 'data' => CarRepository::findFeatured()]);
    }
    if ($method === 'GET' && preg_match('#^/api/cars/(\d+)/invoice/pdf$#', $path, $m)) {
        $auth = Auth::requireUserJson();
        $car = CarRepository::findById($m[1]);
        if (!$car) {
            json_response(['success' => false, 'message' => 'Car not found'], 404);
        }
        $customer = UserRepository::findById((int) $auth['id']);
        if (empty($customer['profile']['passportUrl'])) {
            json_response(['success' => false, 'message' => 'Please upload your passport in My Profile before downloading the invoice.'], 400);
        }
        $early = InvoiceRepository::normalizeEarlyPaymentDiscount($_GET['earlyDiscount'] ?? 0);
        $inv = InvoiceRepository::buildPerCarInvoice($car, $early);
        $pdf = PdfService::proformaToString($car, $customer, $inv);
        $stock = preg_replace('/[^a-zA-Z0-9\-_]/', '', (string) ($car['internalStockNumber'] ?? $car['_id']));
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="TRONEX-PROFORMA-' . ($stock ?: 'CAR') . '.pdf"');
        echo $pdf;
        exit;
    }
    if ($method === 'POST' && preg_match('#^/api/cars/(\d+)/invoice/email$#', $path, $m)) {
        $auth = Auth::requireUserJson();
        $car = CarRepository::findById($m[1]);
        if (!$car) {
            json_response(['success' => false, 'message' => 'Car not found'], 404);
        }
        $customer = UserRepository::findById((int) $auth['id']);
        if (!$customer) {
            json_response(['success' => false, 'message' => 'Customer not found'], 404);
        }
        $body = read_json_body();
        $early = InvoiceRepository::normalizeEarlyPaymentDiscount($body['earlyPaymentDiscount'] ?? 0);
        $invoice = InvoiceRepository::createProformaRecord($car, $customer, $early);
        $inv = InvoiceRepository::buildPerCarInvoice($car, $early);
        $pdf = PdfService::proformaToString($car, $customer, $inv);
        $stock = preg_replace('/[^a-zA-Z0-9\-_]/', '', (string) ($car['internalStockNumber'] ?? $car['_id']));
        $filename = $invoice['invoiceNumber'] . '-TRONEX-PROFORMA-' . ($stock ?: 'CAR') . '.pdf';
        $recipients = array_values(array_unique(array_filter([$customer['email'], ...EmailService::getProformaCcEmails()])));
        $emailSent = false;
        $emailError = null;
        $sendResult = null;
        try {
            $carLabel = trim(($car['make'] ?? '') . ' ' . ($car['model'] ?? ''));
            $dueStr = number_format((float) $invoice['totalCost'], 2);
            $sendResult = EmailService::sendWithPdf(
                $recipients,
                "TRONEX Proforma Invoice {$invoice['invoiceNumber']} - {$carLabel}",
                "Hello,\n\nPlease find attached proforma invoice {$invoice['invoiceNumber']} for {$carLabel}.\nAmount due: KES {$dueStr}.\n\nRegards,\nTRONEX Car Importers",
                $filename,
                $pdf
            );
            $emailSent = true;
        } catch (\Throwable $e) {
            $emailError = $e->getMessage();
        }
        json_response([
            'success' => true,
            'message' => $emailSent ? 'Proforma invoice saved and emailed successfully.' : "Invoice saved, but email failed: {$emailError}",
            'data' => [
                'invoiceId' => $invoice['_id'],
                'invoiceNumber' => $invoice['invoiceNumber'],
                'finalAmountDueKes' => $invoice['totalCost'],
                'earlyPaymentDiscountAppliedKes' => $early,
                'recipients' => $recipients,
                'email' => ['sent' => $emailSent, 'error' => $emailError],
                'provider' => $sendResult['provider'] ?? null,
                'totalCost' => $invoice['totalCost'],
            ],
        ]);
    }
    if ($method === 'GET' && preg_match('#^/api/cars/([^/]+)$#', $path, $m) && $m[1] !== 'featured') {
        $car = CarRepository::findById($m[1]);
        if (!$car) {
            json_response(['success' => false, 'message' => 'Car not found'], 404);
        }
        json_response(['success' => true, 'data' => $car]);
    }

    // ---------- API: Admin cars ----------
    if ($method === 'POST' && $path === '/api/admin/cars') {
        Auth::requireAdminJson();
        $data = validate_car_payload(read_json_body());
        $car = CarRepository::create($data);
        json_response(['success' => true, 'message' => 'Car added successfully', 'data' => $car], 201);
    }
    if ($method === 'PUT' && preg_match('#^/api/admin/cars/(\d+)$#', $path, $m)) {
        Auth::requireAdminJson();
        $data = validate_car_payload(read_json_body());
        $car = CarRepository::update((int) $m[1], $data);
        if (!$car) {
            json_response(['success' => false, 'message' => 'Car not found'], 404);
        }
        json_response(['success' => true, 'message' => 'Car updated successfully', 'data' => $car]);
    }
    if ($method === 'DELETE' && preg_match('#^/api/admin/cars/(\d+)$#', $path, $m)) {
        Auth::requireAdminJson();
        $car = CarRepository::delete((int) $m[1]);
        if (!$car) {
            json_response(['success' => false, 'message' => 'Car not found'], 404);
        }
        json_response(['success' => true, 'message' => 'Car deleted successfully', 'data' => $car]);
    }

    // ---------- API: Image upload ----------
    if ($method === 'POST' && $path === '/api/upload/image') {
        Auth::requireAdminJson();
        if (empty($_FILES['image'])) {
            json_response(['success' => false, 'message' => 'No image file provided'], 400);
        }
        try {
            $data = ImageService::handleCarUpload($_FILES['image']);
            json_response(['success' => true, 'message' => 'Image uploaded successfully', 'data' => $data]);
        } catch (\Throwable $e) {
            json_response(['success' => false, 'message' => 'Error uploading image: ' . $e->getMessage()], 500);
        }
    }
    if ($method === 'POST' && $path === '/api/upload/images') {
        Auth::requireAdminJson();
        if (empty($_FILES['images'])) {
            json_response(['success' => false, 'message' => 'No image files provided'], 400);
        }
        $uploaded = [];
        $files = $_FILES['images'];
        $count = is_array($files['name']) ? count($files['name']) : 1;
        for ($i = 0; $i < $count; $i++) {
            $file = is_array($files['name']) ? [
                'name' => $files['name'][$i],
                'type' => $files['type'][$i],
                'tmp_name' => $files['tmp_name'][$i],
                'error' => $files['error'][$i],
                'size' => $files['size'][$i],
            ] : $files;
            if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                continue;
            }
            try {
                $uploaded[] = ImageService::handleCarUpload($file);
            } catch (\Throwable) {
                // skip failed file
            }
        }
        json_response([
            'success' => true,
            'message' => count($uploaded) . ' images uploaded successfully',
            'data' => $uploaded,
        ]);
    }
    if ($method === 'DELETE' && preg_match('#^/api/upload/image/([^/]+)$#', $path, $m)) {
        Auth::requireAdminJson();
        if (ImageService::deleteCarImage($m[1])) {
            json_response(['success' => true, 'message' => 'Image deleted successfully']);
        }
        json_response(['success' => false, 'message' => 'Image not found'], 404);
    }

    // ---------- API: Invoices ----------
    if ($method === 'GET' && preg_match('#^/api/invoices/car/([^/]+)$#', $path, $m)) {
        $car = CarRepository::findById($m[1]);
        if (!$car) {
            json_response(['success' => false, 'message' => 'Car not found'], 404);
        }
        $invoice = InvoiceRepository::findByCarId((int) $car['id']);
        if (!$invoice) {
            json_response(['success' => false, 'message' => 'Invoice not found for this car'], 404);
        }
        json_response(['success' => true, 'data' => $invoice]);
    }
    if ($method === 'GET' && preg_match('#^/api/invoices/([^/]+)$#', $path, $m) && $m[1] !== 'car') {
        $invoice = InvoiceRepository::resolveByAnyId($m[1]);
        if (!$invoice) {
            json_response(['success' => false, 'message' => 'Invoice not found'], 404);
        }
        json_response(['success' => true, 'data' => $invoice]);
    }
    if ($method === 'PUT' && preg_match('#^/api/invoices/(\d+)/link-customer$#', $path, $m)) {
        $auth = Auth::requireUserJson();
        $customer = UserRepository::findById((int) $auth['id']);
        if (!$customer) {
            json_response(['success' => false, 'message' => 'Customer not found'], 404);
        }
        $invoice = InvoiceRepository::linkCustomer((int) $m[1], $customer);
        if (!$invoice) {
            json_response(['success' => false, 'message' => 'Invoice not found'], 404);
        }
        json_response(['success' => true, 'message' => 'Customer linked to invoice successfully', 'data' => $invoice]);
    }

    // ---------- Web pages ----------
    $pages = [
        '/' => 'index.html',
        '/about-us' => 'about-us.html',
        '/register' => 'register.html',
        '/login' => 'login.html',
        '/stock-list' => 'stock-list.html',
        '/admin-login' => 'admin-login.html',
        '/admin-dashboard' => 'admin.html',
        '/manage-cars' => 'manage-cars.html',
    ];

    if (isset($pages[$path])) {
        render_static_view($pages[$path]);
        exit;
    }

    if ($path === '/admin') {
        header('Location: ' . url_path('/admin-login'), true, 302);
        exit;
    }

    if ($path === '/my-profile' || $path === '/my-profile/') {
        Auth::requireCustomerPage();
        render_static_view('my-profile.html');
        exit;
    }

    if ($path === '/clearing-forwarding') {
        echo '<h1>Clearing &amp; Forwarding Page - Coming Soon</h1><a href="/">Back to Home</a>';
        exit;
    }
    if ($path === '/vessel-schedule') {
        echo '<h1>Vessel Schedule Page - Coming Soon</h1><a href="/">Back to Home</a>';
        exit;
    }
    if ($path === '/testimonials') {
        echo '<h1>Testimonials Page - Coming Soon</h1><a href="/">Back to Home</a>';
        exit;
    }

    if (preg_match('#^/car/(\d+)$#', $path, $m)) {
        $car = CarRepository::findById($m[1]);
        if (!$car) {
            http_response_code(404);
            echo '<h1>Car not found</h1><a href="/stock-list">Back to Stock List</a>';
            exit;
        }
        $car['displayPriceKsh'] = get_display_price_ksh($car);
        render_view('car-details.php', ['car' => $car, 'invoice' => build_car_invoice_view_model($car)]);
        exit;
    }

    if (preg_match('#^/payment-details/(\d+)$#', $path, $m)) {
        Auth::requireUserPage();
        header('Cache-Control: no-store, no-cache, must-revalidate');
        $auth = Auth::decodeToken(Auth::getBearerToken() ?? '') ?? [];
        $car = CarRepository::findById($m[1]);
        if (!$car) {
            http_response_code(404);
            echo '<h1>Car not found</h1>';
            exit;
        }
        $customer = UserRepository::findById((int) ($auth['id'] ?? 0));
        render_view('payment.php', [
            'car' => $car,
            'invoice' => build_car_invoice_view_model($car),
            'customer' => $customer,
        ]);
        exit;
    }

    if (preg_match('#^/payment/(\d+)$#', $path, $m)) {
        $qs = $_SERVER['QUERY_STRING'] ?? '';
        header('Location: ' . url_path('/payment-details/' . $m[1] . ($qs ? '?' . $qs : '')), true, 302);
        exit;
    }

    http_response_code(404);
    echo 'Page not found — <a href="/">Back to Home</a>';
} catch (\Throwable $e) {
    if (str_starts_with($path, '/api/')) {
        json_response(['success' => false, 'message' => 'Internal server error'], 500);
    }
    http_response_code(500);
    echo Tronex\Config::isProduction() ? 'Internal server error' : e($e->getMessage());
}

function public_user(array $user): array
{
    return [
        'id' => $user['_id'] ?? $user['id'],
        'customerId' => $user['customerId'] ?? null,
        'firstName' => $user['firstName'],
        'lastName' => $user['lastName'],
        'email' => $user['email'],
        'mobileNumber' => $user['mobileNumber'],
        'address' => $user['address'] ?? '',
        'city' => $user['city'] ?? '',
        'country' => $user['country'] ?? '',
        'role' => $user['role'],
        'profile' => $user['profile'] ?? [],
        'uploads' => $user['uploads'] ?? [],
        'accountDetails' => $user['accountDetails'] ?? [],
    ];
}

<?php
declare(strict_types=1);

namespace Tronex;

use TCPDF;

final class PdfService
{
    private static function moneyKes(float $n): string
    {
        return 'KES ' . number_format($n, 2);
    }

    public static function proformaToString(array $car, array $customer, array $inv): string
    {
        $pdf = new TCPDF('P', 'mm', 'A4', true, 'UTF-8', false);
        $pdf->SetCreator('Tronex');
        $pdf->SetAuthor('Tronex Car Importers');
        $pdf->SetMargins(15, 15, 15);
        $pdf->SetAutoPageBreak(true, 15);
        $pdf->AddPage();
        $pdf->SetFont('helvetica', '', 10);

        $toName = trim($customer['profile']['legalName'] ?? '') ?: trim(($customer['firstName'] ?? '') . ' ' . ($customer['lastName'] ?? ''));

        $html = '<h1 style="color:#8b0f1a;">TRONEX CAR IMPORTERS LTD</h1>';
        $html .= '<p><strong>Proforma Invoice</strong></p>';
        $html .= '<p>Customer ID: ' . e($customer['customerId'] ?? $customer['_id']) . '<br>';
        $html .= 'Customer Name: ' . e($toName ?: '—') . '<br>';
        $html .= 'Mobile: ' . e($customer['mobileNumber'] ?? '—') . '<br>';
        $html .= 'Email: ' . e($customer['email'] ?? '—') . '</p>';

        $html .= '<h3>Vehicle</h3>';
        $html .= '<p>Stock ID: ' . e($car['internalStockNumber'] ?? '—') . '<br>';
        $html .= 'Make/Model: ' . e(($car['make'] ?? '') . ' ' . ($car['model'] ?? '') . ' (' . ($car['year'] ?? '—') . ')') . '</p>';

        $html .= '<h3>Invoice Items</h3><table border="1" cellpadding="4"><tr><th>Description</th><th align="right">Cost</th></tr>';
        foreach ($inv['items'] as $it) {
            $html .= '<tr><td>' . e($it['label']) . '</td><td align="right">' . e(self::moneyKes((float) $it['value'])) . '</td></tr>';
        }
        $html .= '</table>';

        $html .= '<p align="right">Itemized Total: ' . e(self::moneyKes((float) $inv['itemizedNeedAnalysisTotal'])) . '<br>';
        $html .= 'Duty Payable: ' . e(self::moneyKes((float) $inv['dutyPayable'])) . '<br>';
        $html .= 'Discount: ' . e(self::moneyKes((float) $inv['discount'])) . '<br>';
        if (($inv['earlyPaymentDiscount'] ?? 0) > 0) {
            $html .= 'Early payment discount: ' . e(self::moneyKes((float) $inv['earlyPaymentDiscount'])) . '<br>';
        }
        $html .= '<strong style="color:#8b0f1a;">AMOUNT DUE: ' . e(self::moneyKes((float) $inv['totalCosts'])) . '</strong></p>';

        $bank = $inv['bank'];
        $html .= '<h3>Bank Details</h3><p>';
        $html .= 'Bank: ' . e($bank['bankName']) . '<br>';
        $html .= 'Account: ' . e($bank['accountNumber']) . '<br>';
        $html .= 'M-Pesa Paybill: ' . e($bank['paybill']) . '</p>';

        $pdf->writeHTML($html);
        return $pdf->Output('', 'S');
    }
}

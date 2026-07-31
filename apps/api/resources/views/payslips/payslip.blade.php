<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #0F172A; padding: 40px; }
    .header { width: 100%; margin-bottom: 28px; }
    .brand { font-size: 20px; font-weight: 700; color: #2DA9DD; }
    .company { font-size: 13px; color: #64748B; margin-top: 2px; }
    .title { text-align: right; }
    .title h1 { font-size: 16px; letter-spacing: 1px; color: #1E293B; }
    .title p { color: #64748B; margin-top: 2px; }
    .meta { width: 100%; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; }
    .meta td { padding: 3px 0; }
    .meta .label { color: #64748B; width: 130px; }
    .meta .value { font-weight: 600; }
    table.lines { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    table.lines th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748B; border-bottom: 1px solid #E2E8F0; padding: 6px 8px; }
    table.lines th.num, table.lines td.num { text-align: right; }
    table.lines td { padding: 7px 8px; border-bottom: 1px solid #F1F5F9; }
    .section { font-weight: 700; color: #1E293B; background: #F8FAFC; }
    .total-row td { font-weight: 700; border-top: 1px solid #E2E8F0; }
    .net { width: 100%; background: #2DA9DD; color: #ffffff; border-radius: 6px; padding: 14px 16px; }
    .net .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; opacity: 0.85; }
    .net .amount { font-size: 20px; font-weight: 700; text-align: right; }
    .footer { margin-top: 32px; font-size: 10px; color: #94A3B8; text-align: center; }
</style>
</head>
<body>
    <table class="header">
        <tr>
            <td>
                <div class="brand">{{ $tenantName }}</div>
                <div class="company">Powered by Go3net Office</div>
            </td>
            <td class="title">
                <h1>PAYSLIP</h1>
                <p>{{ $period }}</p>
            </td>
        </tr>
    </table>

    <table class="meta">
        <tr>
            <td class="label">Employee</td>
            <td class="value">{{ $employeeName }}</td>
            <td class="label">Employee code</td>
            <td class="value">{{ $employeeCode }}</td>
        </tr>
        <tr>
            <td class="label">Department</td>
            <td class="value">{{ $department ?? '—' }}</td>
            <td class="label">Published</td>
            <td class="value">{{ $publishedAt }}</td>
        </tr>
    </table>

    <table class="lines">
        <tr><th>Earnings</th><th class="num">Amount (NGN)</th></tr>
        <tr><td>Basic salary</td><td class="num">{{ number_format($basic, 2) }}</td></tr>
        @foreach ($allowances as $name => $amount)
            <tr><td>{{ ucfirst(str_replace('_', ' ', $name)) }} allowance</td><td class="num">{{ number_format($amount, 2) }}</td></tr>
        @endforeach
        @foreach ($bonuses as $name => $amount)
            <tr><td>{{ ucfirst(str_replace('_', ' ', $name)) }}</td><td class="num">{{ number_format($amount, 2) }}</td></tr>
        @endforeach
        <tr class="total-row"><td>Gross pay</td><td class="num">{{ number_format($gross, 2) }}</td></tr>
    </table>

    <table class="lines">
        <tr><th>Deductions</th><th class="num">Amount (NGN)</th></tr>
        <tr><td>Pension (employee, 8%)</td><td class="num">{{ number_format($pension, 2) }}</td></tr>
        <tr><td>PAYE tax</td><td class="num">{{ number_format($paye, 2) }}</td></tr>
        @foreach ($deductions as $name => $amount)
            <tr><td>{{ ucfirst(str_replace('_', ' ', $name)) }}</td><td class="num">{{ number_format($amount, 2) }}</td></tr>
        @endforeach
        <tr class="total-row"><td>Total deductions</td><td class="num">{{ number_format($totalDeductions, 2) }}</td></tr>
    </table>

    <table class="net">
        <tr>
            <td class="label">Net pay</td>
            <td class="amount">₦ {{ number_format($net, 2) }}</td>
        </tr>
    </table>

    <div class="footer">
        This payslip was generated electronically by Go3net Office and is valid without a signature.
    </div>
</body>
</html>

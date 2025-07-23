from flask import Flask, render_template, request, jsonify, send_file
import numpy as np
from scipy.stats import norm
from scipy.special import gamma as gamma_func
import datetime
import io
import pandas as pd

app = Flask(__name__)

def vg_option_price(S, K, T, r, sigma, theta, nu, option_type='call'):
    omega = (1 / nu) * np.log(1 - theta * nu - 0.5 * sigma ** 2 * nu)
    r_adj = r + omega
    N = 10000
    np.random.seed(42)
    G = np.random.gamma(T / nu, nu, N)
    Z = np.random.normal(0, 1, N)
    ST = S * np.exp(r_adj * T + theta * G + sigma * np.sqrt(G) * Z)
    if option_type == 'call':
        payoff = np.maximum(ST - K, 0)
    else:
        payoff = np.maximum(K - ST, 0)
    price = np.exp(-r * T) * np.mean(payoff)
    return price

def vg_greeks(S, K, T, r, sigma, theta, nu):
    dS = 1e-2 * S
    dSigma = 1e-2 * sigma
    dT = 1e-4 * T if T > 0 else 1e-4
    dR = 1e-4
    call = vg_option_price(S, K, T, r, sigma, theta, nu, 'call')
    put = vg_option_price(S, K, T, r, sigma, theta, nu, 'put')
    delta = (vg_option_price(S + dS, K, T, r, sigma, theta, nu, 'call') - call) / dS
    gamma = (vg_option_price(S + dS, K, T, r, sigma, theta, nu, 'call') - 2 * call + vg_option_price(S - dS, K, T, r, sigma, theta, nu, 'call')) / (dS ** 2)
    vega = (vg_option_price(S, K, T, r, sigma + dSigma, theta, nu, 'call') - call) / dSigma
    theta_ = (vg_option_price(S, K, T + dT, r, sigma, theta, nu, 'call') - call) / dT
    rho = (vg_option_price(S, K, T, r + dR, sigma, theta, nu, 'call') - call) / dR
    return call, put, delta, gamma, vega, theta_, rho

def black_scholes_all(S, K, T, r, sigma, option_type='call'):
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return 0, 0, 0, 0, 0, 0, 0
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    call = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    put = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
    delta = norm.cdf(d1) if option_type == 'call' else norm.cdf(d1) - 1
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega = S * norm.pdf(d1) * np.sqrt(T)
    theta = (-S * norm.pdf(d1) * sigma / (2 * np.sqrt(T))) - r * K * np.exp(-r * T) * norm.cdf(d2)
    rho = K * T * np.exp(-r * T) * norm.cdf(d2)
    return call, put, delta, gamma, vega, theta, rho

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/calculate', methods=['POST'])
def calculate():
    data = request.json
    print("Received data:", data)  # Debug: log raw input
    S = float(data['S'])
    K = float(data['K'])
    T = float(data['T'])
    r = float(data['r'])
    sigma = float(data['sigma'])
    theta = float(data['theta'])
    nu = float(data['nu'])
    print(f"Parsed: S={S}, K={K}, T={T}, r={r}, sigma={sigma}, theta={theta}, nu={nu}")  # Debug: log parsed floats

    vg_call, vg_put, vg_delta, vg_gamma, vg_vega, vg_theta, vg_rho = vg_greeks(S, K, T, r, sigma, theta, nu)
    bs_call, bs_put, bs_delta, bs_gamma, bs_vega, bs_theta, bs_rho = black_scholes_all(S, K, T, r, sigma, 'call')

    results = {
        'VG Call Price': f"₹{vg_call:.2f}",
        'VG Put Price': f"₹{vg_put:.2f}",
        'VG Delta': f"{vg_delta:.4f}",
        'VG Gamma': f"{vg_gamma:.4f}",
        'VG Vega': f"{vg_vega:.4f}",
        'VG Theta': f"{vg_theta:.4f}",
        'VG Rho': f"{vg_rho:.4f}",
        'BS Call Price': f"₹{bs_call:.2f}",
        'BS Put Price': f"₹{bs_put:.2f}",
        'BS Delta': f"{bs_delta:.4f}",
        'BS Gamma': f"{bs_gamma:.4f}",
        'BS Vega': f"{bs_vega:.4f}",
        'BS Theta': f"{bs_theta:.4f}",
        'BS Rho': f"{bs_rho:.4f}"
    }
    return jsonify(results)

@app.route('/upload_csv', methods=['POST'])
def upload_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        underlying_s_str = request.form.get('underlying_s')
        if not underlying_s_str:
            return jsonify({'error': 'Underlying asset price (S) for CSV is missing.'}), 400
        underlying_s = float(underlying_s_str)
        if underlying_s <= 0:
            return jsonify({'error': 'Underlying asset price (S) for CSV must be positive.'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid format for Underlying asset price (S) for CSV.'}), 400

    try:
        df = pd.read_csv(file)
        df.columns = [c.strip().upper() for c in df.columns]
    except Exception as e:
        return jsonify({'error': f'Failed to read CSV: {e}. Ensure it is a valid CSV format.'}), 400

    print('Detected columns:', list(df.columns))

    required_columns = ['DATE', 'OPTION TYPE', 'STRIKE PRICE', 'SETTLE PRICE', 'EXPIRY DATE']
    if not all(col in df.columns for col in required_columns):
        missing = [col for col in required_columns if col not in df.columns]
        return jsonify({'error': f"CSV missing required columns. Missing: {missing}. Found: {list(df.columns)}"}), 400

    df = df[df['OPTION TYPE'] == 'CE'].copy()

    results = []
    row_errors = []
    r_default = 0.05
    sigma_default = 0.2
    theta_default = 0.0
    nu_default = 0.2

    for idx, row in df.iterrows():
        try:
            def parse_num(val):
                if isinstance(val, str):
                    return float(val.replace(',', '').strip())
                return float(val)

            S = underlying_s
            K = parse_num(row['STRIKE PRICE'])
            option_market_price = parse_num(row['SETTLE PRICE'])

            # Date parsing
            from datetime import datetime
            date_formats = ['%d-%b-%Y', '%d-%m-%Y', '%Y-%m-%d']
            dt, expdt = None, None
            for fmt in date_formats:
                try:
                    dt = datetime.strptime(str(row['DATE']).strip(), fmt)
                    expdt = datetime.strptime(str(row['EXPIRY DATE']).strip(), fmt)
                    break
                except Exception:
                    continue
            if dt is None or expdt is None:
                # Try pandas fallback
                try:
                    dt = pd.to_datetime(str(row['DATE']).strip(), dayfirst=True)
                    expdt = pd.to_datetime(str(row['EXPIRY DATE']).strip(), dayfirst=True)
                except Exception:
                    raise ValueError(f"Could not parse DATE '{row['DATE']}' or EXPIRY DATE '{row['EXPIRY DATE']}'.")

            T = (expdt - dt).days / 365.0

            r = r_default
            sigma = sigma_default
            theta = theta_default
            nu = nu_default

            # Log all parsed values
            print(f"Row {idx}: S={S}, K={K}, T={T}, sigma={sigma}, nu={nu}, r={r}, theta={theta}")

            if any([pd.isna(x) for x in [S, K, T, sigma, nu, r, theta]]):
                raise ValueError(f"NaN in input values: S={S}, K={K}, T={T}, sigma={sigma}, nu={nu}, r={r}, theta={theta}")
            if S <= 0 or K <= 0 or T <= 0 or sigma <= 0 or nu <= 0:
                raise ValueError(f"Invalid input values: S={S}, K={K}, T={T}, sigma={sigma}, nu={nu}")

            vg_call, vg_put, vg_delta, vg_gamma, vg_vega, vg_theta, vg_rho = vg_greeks(S, K, T, r, sigma, theta, nu)
            bs_call, bs_put, bs_delta, bs_gamma, bs_vega, bs_theta, bs_rho = black_scholes_all(S, K, T, r, sigma, 'call')

            print(f"Row {idx} results: VG Call={vg_call}, BS Call={bs_call}")

            results.append({
                'DATE': row['DATE'],
                'STRIKE PRICE': K,
                'SETTLE PRICE': option_market_price,
                'VG Call Price': vg_call,
                'VG Delta': vg_delta,
                'VG Gamma': vg_gamma,
                'VG Vega': vg_vega,
                'VG Theta': vg_theta,
                'VG Rho': vg_rho,
                'BS Call Price': bs_call,
                'BS Delta': bs_delta,
                'BS Gamma': bs_gamma,
                'BS Vega': bs_vega,
                'BS Theta': bs_theta,
                'BS Rho': bs_rho
            })
        except Exception as e:
            row_errors.append({'row': idx, 'error': str(e), 'data': row.to_dict()})
            print(f"Skipping row {idx} due to error: {e}. Row data: {row.to_dict()}")
            continue

    if not results:
        return jsonify({'error': f'No valid rows processed from CSV. {len(row_errors)} rows failed.', 'row_errors': row_errors}), 400

    return jsonify({'results': results, 'row_errors': len(row_errors), 'total_rows': len(df), 'row_error_details': row_errors})

if __name__ == '__main__':
    app.run(debug=True)

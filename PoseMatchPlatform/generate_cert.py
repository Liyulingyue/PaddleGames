"""
生成开发用自签 HTTPS 证书
运行: python generate_cert.py
输出: cert.pem + key.pem (在项目根目录)
"""
import subprocess
import sys
import os

CERT_FILE = "cert.pem"
KEY_FILE = "key.pem"

def generate():
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        print(f"证书已存在: {CERT_FILE}, {KEY_FILE}")
        print("如需重新生成，请先删除旧证书")
        return

    print("正在生成自签 HTTPS 证书...")

    # 用 openssl 生成
    try:
        subprocess.run([
            "openssl", "req", "-x509",
            "-newkey", "rsa:2048",
            "-keyout", KEY_FILE,
            "-out", CERT_FILE,
            "-days", "365",
            "-nodes",
            "-subj", "/CN=localhost",
            "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0.0.0.0",
        ], check=True, capture_output=True)
        print(f"生成成功: {CERT_FILE}, {KEY_FILE}")
        print("Chrome 访问时点击「高级」→「继续前往」即可信任")
    except FileNotFoundError:
        print("未找到 openssl，尝试用 Python 自带库生成...")
        generate_with_python()
    except subprocess.CalledProcessError as e:
        print(f"openssl 生成失败: {e.stderr.decode()}")
        print("尝试用 Python 自带库生成...")
        generate_with_python()

def generate_with_python():
    """用 Python 标准库生成自签证书（不需要 openssl）"""
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])

        from cryptography.x509 import SubjectAlternativeName, DNSName, IPAddress
        import ipaddress

        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
            .add_extension(
                SubjectAlternativeName([
                    DNSName("localhost"),
                    IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                    IPAddress(ipaddress.IPv4Address("0.0.0.0")),
                ]),
                critical=False,
            )
            .sign(key, hashes.SHA256())
        )

        with open(CERT_FILE, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        with open(KEY_FILE, "wb") as f:
            f.write(key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption(),
            ))

        print(f"生成成功: {CERT_FILE}, {KEY_FILE}")
    except ImportError:
        print("需要安装 cryptography 库: pip install cryptography")
        print("或者安装 openssl 并加入 PATH")
        sys.exit(1)

if __name__ == "__main__":
    generate()

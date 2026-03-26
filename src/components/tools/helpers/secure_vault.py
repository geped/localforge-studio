import os
import json
import base64
import getpass
import sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag
from argon2.low_level import hash_secret_raw, Type

# --- CONFIGURAZIONE CRITTOGRAFICA ---
VERSION = b'\x00\x00\x00\x02'  # 4 byte version identifier

# Parametri Argon2id (OWASP recommendations)
ARGON2_TIME_COST = 3
ARGON2_MEMORY_COST = 65536  # 64 MB
ARGON2_PARALLELISM = 2
ARGON2_HASH_LEN = 32        # 32 byte = 256 bit key
ARGON2_SALT_LEN = 32

# Parametri AES-GCM
NONCE_LEN = 12
TAG_LEN = 16

def derive_key(password: str, salt: bytes) -> bytes:
    """
    Deriva una chiave crittografica a 256 bit dalla password usando Argon2id.
    """
    return hash_secret_raw(
        secret=password.encode('utf-8'),
        salt=salt,
        time_cost=ARGON2_TIME_COST,
        memory_cost=ARGON2_MEMORY_COST,
        parallelism=ARGON2_PARALLELISM,
        hash_len=ARGON2_HASH_LEN,
        type=Type.ID
    )

def encrypt_vault(input_path: str, output_path: str, password: str):
    """
    Cifra un file usando AES-256-GCM e Argon2id.
    """
    try:
        # 1. Leggi i dati originali
        with open(input_path, 'rb') as f:
            data = f.read()

        # 2. Genera Salt e Nonce casuali
        salt = os.urandom(ARGON2_SALT_LEN)
        nonce = os.urandom(NONCE_LEN)

        # 3. Deriva la chiave (Argon2id)
        key = derive_key(password, salt)

        # 4. Prepara AAD (Additional Authenticated Data)
        # Questo lega i metadati al ciphertext. Se salt o nonce vengono alterati, la decifratura fallisce.
        aad = VERSION + salt + nonce

        # 5. Cifra (AES-256-GCM)
        aesgcm = AESGCM(key)
        # La libreria cryptography restituisce ciphertext + tag concatenati
        ciphertext_with_tag = aesgcm.encrypt(nonce, data, aad)

        # Separiamo ciphertext e tag per rispettare la struttura JSON richiesta
        ciphertext = ciphertext_with_tag[:-TAG_LEN]
        tag = ciphertext_with_tag[-TAG_LEN:]

        # 6. Costruisci il dizionario Vault
        vault_data = {
            "v": 2,
            "kdf": "argon2id",
            "salt": base64.b64encode(salt).decode('utf-8'),
            "nonce": base64.b64encode(nonce).decode('utf-8'),
            "tag": base64.b64encode(tag).decode('utf-8'),
            "ciphertext": base64.b64encode(ciphertext).decode('utf-8')
        }

        # 7. Scrivi su file
        with open(output_path, 'w') as f:
            json.dump(vault_data, f, indent=2)

        print(f"✅ File cifrato con successo: {output_path}")

    except Exception as e:
        print(f"❌ Errore durante la cifratura: {e}")
    finally:
        # 8. Cancellazione sicura (Best effort in Python)
        if 'key' in locals():
            del key
        if 'password' in locals():
            del password

def decrypt_vault(vault_path: str, output_path: str, password: str):
    """
    Decifra un file .vault verificando l'integrità (Tag GCM + AAD).
    """
    try:
        # 1. Leggi il file Vault
        with open(vault_path, 'r') as f:
            vault = json.load(f)

        # Verifica versione base
        if vault.get("v") != 2 or vault.get("kdf") != "argon2id":
            raise ValueError("Versione o algoritmo KDF non supportato.")

        # 2. Decodifica Base64
        salt = base64.b64decode(vault["salt"])
        nonce = base64.b64decode(vault["nonce"])
        tag = base64.b64decode(vault["tag"])
        ciphertext = base64.b64decode(vault["ciphertext"])

        # 3. Deriva la chiave
        key = derive_key(password, salt)

        # 4. Ricostruisci AAD
        aad = VERSION + salt + nonce

        # 5. Decifra e Verifica (AES-GCM)
        aesgcm = AESGCM(key)
        
        # La libreria cryptography si aspetta il tag appeso al ciphertext
        ciphertext_with_tag = ciphertext + tag
        
        try:
            original_data = aesgcm.decrypt(nonce, ciphertext_with_tag, aad)
        except InvalidTag:
            # 6. Gestione errore generico per sicurezza
            print("⛔ ERRORE: Decifratura fallita.")
            print("Cause possibili: Password errata O file manomesso/corrotto.")
            return

        # 7. Salva il file decifrato
        with open(output_path, 'wb') as f:
            f.write(original_data)

        print(f"✅ File decifrato con successo: {output_path}")

    except json.JSONDecodeError:
        print("❌ Errore: Il file non è un JSON valido.")
    except Exception as e:
        print(f"❌ Errore generico: {e}")
    finally:
        # 8. Cancellazione sicura
        if 'key' in locals():
            del key
        if 'password' in locals():
            del password

# --- INTERFACCIA CLI ---
def main():
    print("--- FileForge Secure Vault (AES-256-GCM + Argon2id) ---")
    mode = input("Vuoi (C)ifrare o (D)ecifrare? ").strip().upper()

    if mode == 'C':
        input_file = input("Percorso file da cifrare: ").strip().strip('"')
        if not os.path.exists(input_file):
            print("File non trovato.")
            return
        output_file = input_file + ".vault"
        pwd = getpass.getpass("Inserisci Password: ")
        encrypt_vault(input_file, output_file, pwd)

    elif mode == 'D':
        input_file = input("Percorso file .vault: ").strip().strip('"')
        if not os.path.exists(input_file):
            print("File non trovato.")
            return
        # Rimuove .vault se presente, altrimenti aggiunge .decrypted
        if input_file.endswith(".vault"):
            output_file = input_file[:-6]
        else:
            output_file = input_file + ".decrypted"
            
        pwd = getpass.getpass("Inserisci Password: ")
        decrypt_vault(input_file, output_file, pwd)

    else:
        print("Scelta non valida.")

if __name__ == "__main__":
    main()

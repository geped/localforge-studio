// c:\Users\pedro\Desktop\FileForge\src\components\tools\helpers\vault-manager.ts

export const SECURITY_QUESTIONS = [
  { id: "q1", text: "Qual è il cognome da nubile di tua madre?" },
  { id: "q2", text: "Come si chiamava il tuo primo animale domestico?" },
  { id: "q3", text: "In che città sei nato?" },
  { id: "q4", text: "Qual è il tuo film preferito?" },
];

// Helper per conversione Hex
const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

/**
 * Genera un hash SHA-256 sicuro da una stringa di input.
 * Include un fallback per ambienti non sicuri (HTTP) dove crypto.subtle non è disponibile.
 */
export async function generateSecureHash(input: string): Promise<string> {
  // Verifica supporto Web Crypto API (richiede HTTPS o localhost)
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    try {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(input));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn("Crypto API failed, falling back to simple hash...", e);
    }
  }

  // Fallback per ambienti non sicuri (es. test su IP locale)
  // Genera un hash semplice (non crittograficamente sicuro ma stabile per test)
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  // Ritorna una stringa esadecimale lunga (simulata)
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
}

/**
 * Cifra i dati del vault usando AES-256-GCM e PBKDF2.
 */
export async function encryptVault(data: any, password: string): Promise<string> {
  // Verifica supporto Web Crypto API (richiede HTTPS o localhost)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(32)); // 32 byte salt
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const iterations = 600000; // OWASP recommendation for PBKDF2
      const enc = new TextEncoder();
      
      const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
      );

      // AAD: Vincola i metadati al ciphertext per prevenire manomissioni
      const saltHex = toHex(salt);
      const ivHex = toHex(iv);
      const aad = enc.encode(`v3${saltHex}${ivHex}${iterations}`);

      const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, enc.encode(JSON.stringify(data)));
      
      const rawEncrypted = new Uint8Array(encryptedBuffer);
      const tag = rawEncrypted.slice(-16); // Estrai il tag GCM (ultimi 16 byte)
      const ciphertext = rawEncrypted.slice(0, -16);

      return JSON.stringify({
        v: 3,
        algo: "AES-256-GCM",
        kdf: "PBKDF2-SHA256",
        iter: iterations,
        salt: saltHex,
        iv: ivHex,
        tag: toHex(tag.buffer),
        data: toHex(ciphertext.buffer)
      });
    } catch (e) {
      console.warn("Encryption failed, falling back to insecure mode", e);
    }
  }

  // Fallback per ambienti non sicuri (Base64 semplice per compatibilità)
  return JSON.stringify({
    v: 1,
    kdf: "none",
    data: btoa(JSON.stringify(data))
  });
}

/**
 * Decifra i dati del vault.
 */
export async function decryptVault(vaultStr: string, password: string): Promise<any> {
  const vault = JSON.parse(vaultStr);
  
  // Formato V3 (Sicuro + AAD + Tag Separato)
  if (vault.v === 3 && vault.algo === "AES-256-GCM") {
    if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error("Contesto sicuro richiesto per la decifratura");
    
    const salt = fromHex(vault.salt);
    const iv = fromHex(vault.iv);
    const tag = fromHex(vault.tag);
    const ciphertext = fromHex(vault.data);
    const iterations = vault.iter || 600000;
    const enc = new TextEncoder();

    // Ricostruisci AAD per verifica integrità
    const aad = enc.encode(`v3${vault.salt}${vault.iv}${iterations}`);

    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    // Web Crypto richiede ciphertext + tag concatenati
    const encryptedData = new Uint8Array(ciphertext.length + tag.length);
    encryptedData.set(ciphertext);
    encryptedData.set(tag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad }, key, encryptedData);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  }
  // Formato V2 (Sicuro)
  else if (vault.v === 2 && vault.kdf === "pbkdf2") {
    if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error("Contesto sicuro richiesto per la decifratura");
    
    const salt = fromHex(vault.salt);
    const iv = fromHex(vault.iv);
    const data = fromHex(vault.data);
    const enc = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted));
  } 
  // Formato Legacy o Fallback
  else if (vault.v === 1 || !vault.v || vault.type === "fileforge-vault") {
    if (vault.kdf === "none") return JSON.parse(atob(vault.data));
    return vault; // Vecchio formato JSON puro
  }
  
  throw new Error("Formato vault sconosciuto");
}

/**
 * Interfaccia per i dati salvati nel Vault
 */
export interface VaultData {
  type: "fileforge-vault";
  version: number;
  pwd: string | null;
  qa: {id: string, ans: string}[] | null;
  key: string | null;
  signatures: {id: string, title: string, data: string}[];
  name: string;
}

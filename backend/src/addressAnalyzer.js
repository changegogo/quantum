import bs58check from "bs58check";
import { bech32, bech32m } from "bech32";

function decodeBase58Address(address) {
  const payload = bs58check.decode(address);
  const version = payload[0];
  return { version };
}

function decodeBech32Address(address) {
  try {
    const decoded = bech32.decode(address);
    return {
      encoding: "bech32",
      hrp: decoded.prefix,
      version: decoded.words[0],
    };
  } catch {
    const decoded = bech32m.decode(address);
    return {
      encoding: "bech32m",
      hrp: decoded.prefix,
      version: decoded.words[0],
    };
  }
}

export function detectAddressType(address) {
  const trimmed = address.trim();

  if (/^(1|3|m|n|2)/.test(trimmed)) {
    const { version } = decodeBase58Address(trimmed);
    if (version === 0x00) return "P2PKH(mainnet)";
    if (version === 0x05) return "P2SH(mainnet)";
    if (version === 0x6f) return "P2PKH(testnet)";
    if (version === 0xc4) return "P2SH(testnet)";
  }

  if (/^(bc1|tb1|bcrt1)/i.test(trimmed)) {
    const { hrp, version, encoding } = decodeBech32Address(trimmed.toLowerCase());

    if (version === 0 && encoding === "bech32") {
      const isMainnet = hrp === "bc";
      return isMainnet ? "P2WPKH/P2WSH(mainnet)" : "P2WPKH/P2WSH(testnet)";
    }

    if (version === 1 && encoding === "bech32m") {
      const isMainnet = hrp === "bc";
      return isMainnet ? "P2TR(mainnet)" : "P2TR(testnet)";
    }
  }

  throw new Error("无法识别或不支持的比特币地址格式");
}

export function evaluatePublicKeyExposure(addressType, spentTxoCount) {
  if (addressType.startsWith("P2TR")) {
    return {
      exposed: true,
      certainty: "high",
      reason: "Taproot 地址的见证程序本身对应输出公钥信息，可视作天然公钥暴露。",
    };
  }

  if (spentTxoCount > 0) {
    return {
      exposed: true,
      certainty: "medium",
      reason:
        "该地址已有花费记录，典型场景下花费输入会暴露公钥或脚本中的公钥信息（尤其是 P2PKH/P2WPKH）。",
    };
  }

  return {
    exposed: false,
    certainty: "medium",
    reason: "该地址当前未检测到花费记录，常见单签地址在未花费前不会在链上暴露公钥。",
  };
}

export function extractAddressLevelPublicKey(address, addressType) {
  const trimmed = address.trim().toLowerCase();
  if (!addressType.startsWith("P2TR")) return null;

  try {
    const decoded = bech32m.decode(trimmed);
    const words = decoded.words.slice(1);
    const bytes = bech32m.fromWords(words);
    const hex = Buffer.from(bytes).toString("hex");
    return /^[0-9a-f]{64}$/i.test(hex) ? hex : null;
  } catch {
    return null;
  }
}

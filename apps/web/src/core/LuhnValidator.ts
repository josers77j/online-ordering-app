export class LuhnValidator {
  static isValid(cardNumber: string): boolean {
    const digits = cardNumber.replace(/[\s-]/g, "");

    if (!/^\d+$/.test(digits) || digits.length < 13 || digits.length > 19) {
      return false;
    }

    let sum = 0;
    let shouldDouble = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = Number.parseInt(digits[i], 10);

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    return sum % 10 === 0;
  }
  static detectType(cardNumber: string): string {
    const digits = cardNumber.replace(/[\s-]/g, "");
    if (digits.startsWith("4")) return "Visa";
    if (/^5[1-5]/.test(digits)) return "Mastercard";
    if (/^3[47]/.test(digits)) return "Amex";
    if (/^6(?:011|5)/.test(digits)) return "Discover";
    return "Desconocida";
  }

  static format(cardNumber: string): string {
    return cardNumber
      .replace(/[\s-]/g, "")
      .replace(/(.{4})/g, "$1 ")
      .trim();
  }
}

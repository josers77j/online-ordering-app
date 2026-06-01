export class DUIFormatter {
  static format(input: string): string {
    const cleaned = input.replace(/[^\d]/g, "");
    if (cleaned.length === 0) return "";
    if (cleaned.length <= 8) return cleaned;
    return `${cleaned.slice(0, 8)}-${cleaned.slice(8, 9)}`;
  }

  static unformat(input: string): string {
    return input.replace(/[^\d]/g, "");
  }
}

export class NITFormatter {
  static format(input: string): string {
    const cleaned = input.replace(/[^\d]/g, "");
    if (cleaned.length === 0) return "";
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 10)
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    if (cleaned.length <= 13) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 10)}-${cleaned.slice(10)}`;
    }
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 10)}-${cleaned.slice(10, 13)}-${cleaned.slice(13, 14)}`;
  }

  static unformat(input: string): string {
    return input.replace(/[^\d]/g, "");
  }
}

export class ExpiryFormatter {
  static format(input: string): string {
    const cleaned = input.replace(/[^\d]/g, "");
    if (cleaned.length === 0) return "";
    if (cleaned.length === 1) return cleaned;
    if (cleaned.length === 2) {
      
      const month = Number.parseInt(cleaned, 10);
      if (month < 1 || month > 12) return cleaned;
      return cleaned;
    }
    if (cleaned.length >= 3) {
      const month = cleaned.slice(0, 2);
      const year = cleaned.slice(2, 4);
      return `${month}/${year}`;
    }
    return cleaned;
  }

  static unformat(input: string): string {
    return input.replace(/[^\d]/g, "");
  }

  static isValidMonth(monthStr: string): boolean {
    const month = Number.parseInt(monthStr, 10);
    return month >= 1 && month <= 12;
  }

  static isExpired(expiryStr: string): boolean {
    const cleaned = expiryStr.replace(/[^\d]/g, "");
    if (cleaned.length < 4) return false;
    const month = Number.parseInt(cleaned.slice(0, 2), 10);
    const year = Number.parseInt(cleaned.slice(2, 4), 10);
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;
    if (year < currentYear) return true;
    if (year === currentYear && month < currentMonth) return true;
    return false;
  }
}

export class CVCFormatter {
  static format(input: string): string {
    return input.replace(/[^\d]/g, "").slice(0, 4);
  }

  static unformat(input: string): string {
    return input;
  }

  static isValid(cvc: string): boolean {
    const cleaned = cvc.replace(/[^\d]/g, "");
    return cleaned.length >= 3 && cleaned.length <= 4;
  }
}

export class CardNumberFormatter {
  static format(input: string): string {
    const cleaned = input.replace(/[^\d\s]/g, "").replace(/\s/g, "");
    if (cleaned.length === 0) return "";
    const groups = cleaned.match(/.{1,4}/g) || [];
    return groups.join(" ");
  }

  static unformat(input: string): string {
    return input.replace(/[^\d]/g, "");
  }
}

export class PriceFormatter {
  static format(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  static parse(priceStr: string): number {
    const cleaned = priceStr.replace(/[^0-9.]/g, "");
    return Math.round(Number.parseFloat(cleaned) * 100);
  }
}

export interface IFormatter<T> {
  format(input: string): T;
  unformat(input: T): string;
}

export const Formatters = {
  DUI: DUIFormatter,
  NIT: NITFormatter,
  Expiry: ExpiryFormatter,
  CVC: CVCFormatter,
  CardNumber: CardNumberFormatter,
  Price: PriceFormatter,
};

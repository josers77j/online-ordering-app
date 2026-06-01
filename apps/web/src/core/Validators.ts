export interface IValidator {
  validate(input: string): { isValid: boolean; error?: string };
}

export class DUIValidator implements IValidator {
  validate(input: string): { isValid: boolean; error?: string } {
    const cleaned = input.replace(/[^\d-]/g, "");

    if (!cleaned) {
      return { isValid: false, error: "DUI no puede estar vacío" };
    }

    if (!/^\d{8}-\d$/.test(cleaned)) {
      return {
        isValid: false,
        error:
          "DUI debe tener formato: ########-# (8 dígitos, guion, 1 dígito)",
      };
    }

    const digits = cleaned.slice(0, 8);
    const weights = [9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    for (let i = 0; i < 8; i++) {
      sum += Number.parseInt(digits[i], 10) * weights[i];
    }

    const expectedCheck = (10 - (sum % 10)) % 11;
    const actualCheck = Number.parseInt(cleaned[9], 10);

    if (expectedCheck !== actualCheck && expectedCheck !== 10) {
      return { isValid: false, error: "DUI tiene dígito de control inválido" };
    }

    return { isValid: true };
  }
}

export class NITValidator implements IValidator {
  validate(input: string): { isValid: boolean; error?: string } {
    const cleaned = input.replace(/[^\d-]/g, "");

    if (!cleaned) {
      return { isValid: false, error: "NIT no puede estar vacío" };
    }

    if (!/^\d{4}-\d{6}-\d{3}-\d$/.test(cleaned)) {
      return {
        isValid: false,
        error: "NIT debe tener formato: ####-######-###-#",
      };
    }

    const allDigits = cleaned.replace(/-/g, "");
    const weights = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;

    for (let i = 0; i < 13; i++) {
      sum += Number.parseInt(allDigits[i], 10) * weights[i];
    }

    const residuo = sum % 11;
    const expectedCheck = residuo < 2 ? 0 : 11 - residuo;
    const actualCheck = Number.parseInt(allDigits[13], 10);

    if (expectedCheck !== actualCheck) {
      return { isValid: false, error: "NIT tiene dígito de control inválido" };
    }

    return { isValid: true };
  }
}

export class NRCValidator implements IValidator {
  validate(input: string): { isValid: boolean; error?: string } {
    const cleaned = input.replace(/[^\d]/g, "");

    if (!cleaned) {
      return { isValid: false, error: "NRC no puede estar vacío" };
    }

    if (cleaned.length > 8) {
      return { isValid: false, error: "NRC no puede exceder 8 dígitos" };
    }

    return { isValid: true };
  }
}

export class BusinessNameValidator implements IValidator {
  validate(input: string): { isValid: boolean; error?: string } {
    const trimmed = input.trim();

    if (!trimmed) {
      return { isValid: false, error: "Razón Social no puede estar vacía" };
    }

    if (trimmed.length < 3) {
      return {
        isValid: false,
        error: "Razón Social debe tener al menos 3 caracteres",
      };
    }

    if (trimmed.length > 100) {
      return {
        isValid: false,
        error: "Razón Social no puede exceder 100 caracteres",
      };
    }

    return { isValid: true };
  }
}

export class FullNameValidator implements IValidator {
  validate(input: string): { isValid: boolean; error?: string } {
    const trimmed = input.trim();

    if (!trimmed) {
      return { isValid: false, error: "Nombre completo no puede estar vacío" };
    }

    if (trimmed.length < 3) {
      return {
        isValid: false,
        error: "Nombre debe tener al menos 3 caracteres",
      };
    }

    if (trimmed.length > 80) {
      return { isValid: false, error: "Nombre no puede exceder 80 caracteres" };
    }

    const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
    if (words.length < 2) {
      return { isValid: false, error: "Nombre debe incluir nombre y apellido" };
    }

    return { isValid: true };
  }
}

export class ExpiryValidator implements IValidator {
  validate(input: string): { isValid: boolean; error?: string } {
    const cleaned = input.replace(/[^\d]/g, "");

    if (cleaned.length !== 4) {
      return { isValid: false, error: "Fecha debe ser MM/YY (4 dígitos)" };
    }

    const month = Number.parseInt(cleaned.slice(0, 2), 10);
    const year = Number.parseInt(cleaned.slice(2, 4), 10);

    if (month < 1 || month > 12) {
      return { isValid: false, error: "Mes debe estar entre 01 y 12" };
    }

    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return { isValid: false, error: "Tarjeta expirada" };
    }

    return { isValid: true };
  }
}

export class CVCValidator implements IValidator {
  validate(input: string): { isValid: boolean; error?: string } {
    const cleaned = input.replace(/[^\d]/g, "");

    if (cleaned.length < 3 || cleaned.length > 4) {
      return { isValid: false, error: "CVC debe tener 3 o 4 dígitos" };
    }

    return { isValid: true };
  }
}

export class ValidationService {
  private validators: Record<string, IValidator> = {
    dui: new DUIValidator(),
    nit: new NITValidator(),
    nrc: new NRCValidator(),
    businessName: new BusinessNameValidator(),
    fullName: new FullNameValidator(),
    expiry: new ExpiryValidator(),
    cvc: new CVCValidator(),
  };

  registerValidator(name: string, validator: IValidator): void {
    this.validators[name] = validator;
  }

  validate(
    validatorName: string,
    input: string,
  ): { isValid: boolean; error?: string } {
    const validator = this.validators[validatorName];
    if (!validator) {
      throw new Error(`Validator not found: ${validatorName}`);
    }
    return validator.validate(input);
  }

  validateConsumerForm(
    fullName: string,
    documentId: string,
  ): Record<string, string> {
    const errors: Record<string, string> = {};

    const nameCheck = this.validate("fullName", fullName);
    if (!nameCheck.isValid) errors.fullName = nameCheck.error!;

    const duiCheck = this.validate("dui", documentId);
    if (!duiCheck.isValid) errors.documentId = duiCheck.error!;

    return errors;
  }

  validateCreditFiscalForm(
    businessName: string,
    nit: string,
    nrc: string,
  ): Record<string, string> {
    const errors: Record<string, string> = {};

    const nameCheck = this.validate("businessName", businessName);
    if (!nameCheck.isValid) errors.businessName = nameCheck.error!;

    const nitCheck = this.validate("nit", nit);
    if (!nitCheck.isValid) errors.nit = nitCheck.error!;

    const nrcCheck = this.validate("nrc", nrc);
    if (!nrcCheck.isValid) errors.nrc = nrcCheck.error!;

    return errors;
  }

  validatePaymentForm(expiry: string, cvc: string): Record<string, string> {
    const errors: Record<string, string> = {};
    const expiryCheck = this.validate("expiry", expiry);

    if (!expiryCheck.isValid) errors.expiry = expiryCheck.error!;

    const cvcCheck = this.validate("cvc", cvc);
    if (!cvcCheck.isValid) errors.cvc = cvcCheck.error!;

    return errors;
  }
}

export const validationService = new ValidationService();

export const isValidMobile = (mobile) => {
  return /^[6-9]\d{9}$/.test(mobile);
};

export const isValidOtp = (otp) => {
  return /^\d{6}$/.test(otp);
};

export const isValidName = (name) => {
  return name && name.trim().length >= 3;
};

export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim());
};

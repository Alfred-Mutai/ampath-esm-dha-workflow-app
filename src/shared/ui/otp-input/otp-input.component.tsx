import React, { useRef, useState } from 'react';
import { TextInput } from '@carbon/react';
import styles from './otp-input.component.scss';

interface OTPInputProps {
  onChange: (otp: string) => void;
  otpLength: number;
  disabled?: boolean;
}

const OTPInput: React.FC<OTPInputProps> = ({ onChange, otpLength, disabled = false }) => {
  const [otp, setOtp] = useState(Array(otpLength).fill(''));
  const inputsRef = useRef([]);

  if (!otpLength) {
    return <>OTP Length not defined</>;
  }

  const focusInput = (index) => {
    if (inputsRef.current[index]) {
      inputsRef.current[index].focus();
    }
  };

  const handleChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < otpLength - 1) {
      focusInput(index + 1);
    }

    onChange?.(newOtp.join(''));
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpLength);

    if (!pasted) return;

    const newOtp = [...otp];
    pasted.split('').forEach((digit, i) => {
      newOtp[i] = digit;
    });

    setOtp(newOtp);
    onChange?.(newOtp.join(''));
    focusInput(pasted.length - 1);
  };

  return (
    <div className={styles.otpInputContainer} onPaste={disabled ? undefined : handlePaste}>
      {otp.map((digit, index) => (
        <div className={styles.otpDataInputContainer}>
          <TextInput
            className={styles.otpDataInput}
            key={index}
            id={`otp-${index}`}
            value={digit}
            labelText=""
            hideLabel
            maxLength={1}
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={disabled}
            ref={(el) => (inputsRef.current[index] = el)}
            onChange={(e) => handleChange(e.target.value, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            style={{
              height: '3.5rem',
              width: '3rem',
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 600,
              color: disabled ? '#a8a8a8' : '#161616',
              backgroundColor: disabled ? '#f4f4f4' : '#ffffff',
              border: '1px solid #8d8d8d',
              borderRadius: '6px',
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default OTPInput;

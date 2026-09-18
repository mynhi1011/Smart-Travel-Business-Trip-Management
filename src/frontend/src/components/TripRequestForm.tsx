/**
 * TripRequestForm.tsx — Form tạo chuyến công tác (tách từ App.tsx để testable)
 *
 * Props:
 *   onSubmit(payload) — callback khi form submit hợp lệ (gọi createTrip service)
 *   isLoading — disable form khi đang call API
 *   apiError — error message từ API response (validation server-side)
 *
 * Client-side validation:
 *   - origin: required
 *   - destination: required
 *   - destinationType: required
 *   - departureDate: required, >= hôm nay
 *   - returnDate: required, >= departureDate
 *   - purpose: required, tối thiểu 10 ký tự
 *   - estimatedBudget: required, > 0
 */

import { useState, type FormEvent } from 'react';

export interface TripFormPayload {
  origin: string;
  destination: string;
  destinationType: 'TIER1_CITY' | 'OTHER';
  departureDate: string;
  returnDate: string;
  purpose: string;
  estimatedBudget: number;
  urgencyReason?: string;
}

export interface TripRequestFormProps {
  onSubmit: (payload: TripFormPayload) => void | Promise<void>;
  isLoading?: boolean;
  apiError?: string | null;
}

interface FormErrors {
  origin?: string;
  destination?: string;
  destinationType?: string;
  departureDate?: string;
  returnDate?: string;
  purpose?: string;
  estimatedBudget?: string;
}

export function TripRequestForm({
  onSubmit,
  isLoading = false,
  apiError = null,
}: TripRequestFormProps) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [destinationType, setDestinationType] = useState<'TIER1_CITY' | 'OTHER' | ''>('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): FormErrors {
    const errs: FormErrors = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!origin.trim()) {
      errs.origin = 'Vui lòng nhập điểm xuất phát';
    }

    if (!destination.trim()) {
      errs.destination = 'Vui lòng nhập điểm đến';
    }

    if (!destinationType) {
      errs.destinationType = 'Vui lòng chọn loại điểm đến';
    }

    if (!departureDate) {
      errs.departureDate = 'Vui lòng nhập ngày khởi hành';
    } else {
      const dep = new Date(departureDate + 'T00:00:00');
      if (dep < today) {
        errs.departureDate = 'Ngày khởi hành không được trong quá khứ';
      }
    }

    if (!returnDate) {
      errs.returnDate = 'Vui lòng nhập ngày về';
    } else if (departureDate && returnDate < departureDate) {
      errs.returnDate = 'Ngày về phải sau hoặc bằng ngày khởi hành';
    }

    if (!purpose.trim()) {
      errs.purpose = 'Vui lòng nhập mục đích công tác';
    } else if (purpose.trim().length < 10) {
      errs.purpose = 'Mục đích công tác tối thiểu 10 ký tự';
    }

    const budget = parseFloat(estimatedBudget);
    if (!estimatedBudget) {
      errs.estimatedBudget = 'Vui lòng nhập tổng dự toán';
    } else if (isNaN(budget) || budget <= 0) {
      errs.estimatedBudget = 'Tổng dự toán phải lớn hơn 0';
    }

    return errs;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    void onSubmit({
      origin: origin.trim(),
      destination: destination.trim(),
      destinationType: destinationType as 'TIER1_CITY' | 'OTHER',
      departureDate,
      returnDate,
      purpose: purpose.trim(),
      estimatedBudget: parseInt(estimatedBudget, 10),
    });
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Tạo chuyến công tác" noValidate>

      <div>
        <label htmlFor="trip-origin">Điểm xuất phát</label>
        <input
          id="trip-origin"
          type="text"
          value={origin}
          onChange={e => setOrigin(e.target.value)}
          placeholder="Ví dụ: Hà Nội"
          disabled={isLoading}
          aria-invalid={!!errors.origin}
          aria-describedby={errors.origin ? 'origin-error' : undefined}
        />
        {errors.origin && (
          <span id="origin-error" role="alert" data-testid="origin-error">
            {errors.origin}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="trip-destination">Điểm đến</label>
        <input
          id="trip-destination"
          type="text"
          value={destination}
          onChange={e => setDestination(e.target.value)}
          placeholder="Ví dụ: TP. Hồ Chí Minh"
          disabled={isLoading}
          aria-invalid={!!errors.destination}
          aria-describedby={errors.destination ? 'destination-error' : undefined}
        />
        {errors.destination && (
          <span id="destination-error" role="alert" data-testid="destination-error">
            {errors.destination}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="trip-destination-type">Loại điểm đến</label>
        <select
          id="trip-destination-type"
          value={destinationType}
          onChange={e => setDestinationType(e.target.value as 'TIER1_CITY' | 'OTHER' | '')}
          disabled={isLoading}
          aria-invalid={!!errors.destinationType}
        >
          <option value="">-- Chọn loại điểm đến --</option>
          <option value="TIER1_CITY">Thành phố lớn (Tier 1)</option>
          <option value="OTHER">Tỉnh/thành phố khác</option>
        </select>
        {errors.destinationType && (
          <span role="alert" data-testid="destination-type-error">
            {errors.destinationType}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="trip-departure-date">Ngày khởi hành</label>
        <input
          id="trip-departure-date"
          type="date"
          value={departureDate}
          onChange={e => setDepartureDate(e.target.value)}
          disabled={isLoading}
          aria-invalid={!!errors.departureDate}
          aria-describedby={errors.departureDate ? 'departure-error' : undefined}
        />
        {errors.departureDate && (
          <span id="departure-error" role="alert" data-testid="departure-date-error">
            {errors.departureDate}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="trip-return-date">Ngày về</label>
        <input
          id="trip-return-date"
          type="date"
          value={returnDate}
          onChange={e => setReturnDate(e.target.value)}
          disabled={isLoading}
          aria-invalid={!!errors.returnDate}
          aria-describedby={errors.returnDate ? 'return-error' : undefined}
        />
        {errors.returnDate && (
          <span id="return-error" role="alert" data-testid="return-date-error">
            {errors.returnDate}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="trip-purpose">Mục đích công tác</label>
        <textarea
          id="trip-purpose"
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
          placeholder="Mô tả mục đích chuyến công tác (tối thiểu 10 ký tự)"
          rows={3}
          disabled={isLoading}
          aria-invalid={!!errors.purpose}
          aria-describedby={errors.purpose ? 'purpose-error' : undefined}
        />
        {errors.purpose && (
          <span id="purpose-error" role="alert" data-testid="purpose-error">
            {errors.purpose}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="trip-budget">Tổng dự toán (VNĐ)</label>
        <input
          id="trip-budget"
          type="number"
          min="1"
          value={estimatedBudget}
          onChange={e => setEstimatedBudget(e.target.value)}
          placeholder="Ví dụ: 8000000"
          disabled={isLoading}
          aria-invalid={!!errors.estimatedBudget}
          aria-describedby={errors.estimatedBudget ? 'budget-error' : undefined}
        />
        {errors.estimatedBudget && (
          <span id="budget-error" role="alert" data-testid="budget-error">
            {errors.estimatedBudget}
          </span>
        )}
      </div>

      {/* API-level error */}
      {apiError && (
        <div role="alert" data-testid="api-error">
          {apiError}
        </div>
      )}

      <button type="submit" disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? 'Đang gửi...' : 'Tạo chuyến đi'}
      </button>
    </form>
  );
}

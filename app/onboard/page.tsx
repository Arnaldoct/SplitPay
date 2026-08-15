"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/app/components/ui";

type BusinessType = "sole_proprietor" | "llc" | "corporation" | "partnership" | "nonprofit" | "other";

interface FormData {
  // Step 1: Basic Info
  name: string;
  legalName: string;
  businessType: BusinessType | "";
  taxId: string;
  country: string;

  // Step 2: Location & Contact
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string;
  timezone: string;

  // Step 3: Branding (optional)
  logoUrl: string;
  brandColor: string;
}

const COUNTRIES = [
  { code: "US", name: "United States", taxIdLabel: "EIN", taxIdPlaceholder: "12-3456789" },
  { code: "MX", name: "Mexico", taxIdLabel: "RFC", taxIdPlaceholder: "ABC123456D10" },
  { code: "HN", name: "Honduras", taxIdLabel: "RTN", taxIdPlaceholder: "0801-1990-12345" },
  { code: "GT", name: "Guatemala", taxIdLabel: "NIT", taxIdPlaceholder: "1234567-8" },
  { code: "SV", name: "El Salvador", taxIdLabel: "NIT", taxIdPlaceholder: "0614-010190-101-0" },
  { code: "CR", name: "Costa Rica", taxIdLabel: "Cédula Jurídica", taxIdPlaceholder: "3-101-123456" },
  { code: "PA", name: "Panama", taxIdLabel: "RUC", taxIdPlaceholder: "12345-678-901234" },
];

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: "sole_proprietor", label: "Sole Proprietor" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "other", label: "Other" },
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Tegucigalpa", label: "Honduras (CST)" },
  { value: "America/Guatemala", label: "Guatemala (CST)" },
  { value: "America/Mexico_City", label: "Mexico City (CST)" },
  { value: "America/Panama", label: "Panama (EST)" },
  { value: "America/Costa_Rica", label: "Costa Rica (CST)" },
];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    legalName: "",
    businessType: "",
    taxId: "",
    country: "US",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    website: "",
    timezone: "America/New_York",
    logoUrl: "",
    brandColor: "#6B21A8",
  });

  // Try to detect timezone on mount
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONES.find((tz) => tz.value === detected)) {
      setFormData((prev) => ({ ...prev, timezone: detected }));
    }
  }, []);

  const selectedCountry = COUNTRIES.find((c) => c.code === formData.country) || COUNTRIES[0];

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return (
          formData.name.trim() &&
          formData.legalName.trim() &&
          formData.businessType &&
          formData.taxId.trim() &&
          formData.country
        );
      case 2:
        return (
          formData.address.trim() &&
          formData.city.trim() &&
          formData.state.trim() &&
          formData.zip.trim() &&
          formData.phone.trim() &&
          formData.timezone
        );
      case 3:
        return true; // Branding is optional
      case 4:
        return termsAccepted;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to complete onboarding");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-purple-950 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Wordmark size="xl" />
          <p className="text-purple-200 mt-2">Let&apos;s set up your restaurant</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    s < step
                      ? "bg-green-500 text-white"
                      : s === step
                      ? "bg-white text-purple-900"
                      : "bg-purple-700 text-purple-300"
                  }`}
                >
                  {s < step ? "✓" : s}
                </div>
                {s < 4 && (
                  <div
                    className={`w-8 h-1 mx-1 rounded ${
                      s < step ? "bg-green-500" : "bg-purple-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Business Information</h2>
                <p className="text-gray-600 mt-1">Tell us about your restaurant</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Restaurant Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="The Blue Agave"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">This is what guests will see</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Legal Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.legalName}
                    onChange={(e) => updateField("legalName", e.target.value)}
                    placeholder="Blue Agave Restaurant LLC"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.businessType}
                    onChange={(e) => updateField("businessType", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select business type</option>
                    {BUSINESS_TYPES.map((bt) => (
                      <option key={bt.value} value={bt.value}>
                        {bt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {selectedCountry.taxIdLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) => updateField("taxId", e.target.value)}
                    placeholder={selectedCountry.taxIdPlaceholder}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will appear on guest receipts
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location & Contact */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Location & Contact</h2>
                <p className="text-gray-600 mt-1">Where can guests find you?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="123 Main Street"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="Austin"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State/Region <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => updateField("state", e.target.value)}
                      placeholder="TX"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Postal Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.zip}
                      onChange={(e) => updateField("zip", e.target.value)}
                      placeholder="78701"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Timezone <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => updateField("timezone", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+1 (512) 555-0123"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://blueagave.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Branding */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Branding</h2>
                <p className="text-gray-600 mt-1">Customize how guests see your restaurant (optional)</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Logo URL <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={formData.logoUrl}
                    onChange={(e) => updateField("logoUrl", e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Shown on the QR code landing page and receipts
                  </p>
                </div>

                {formData.logoUrl && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Preview:</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={formData.logoUrl}
                      alt="Logo preview"
                      className="max-h-20 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand Color <span className="text-gray-400">(optional)</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={formData.brandColor}
                      onChange={(e) => updateField("brandColor", e.target.value)}
                      className="w-12 h-12 rounded cursor-pointer border-0"
                    />
                    <input
                      type="text"
                      value={formData.brandColor}
                      onChange={(e) => updateField("brandColor", e.target.value)}
                      placeholder="#6B21A8"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Used as an accent color on guest-facing pages
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-3">Color preview:</p>
                  <button
                    style={{ backgroundColor: formData.brandColor }}
                    className="px-6 py-3 text-white font-semibold rounded-xl"
                  >
                    Pay $45.00
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Terms */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Review & Confirm</h2>
                <p className="text-gray-600 mt-1">Make sure everything looks correct</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Business Information</h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-gray-500">Restaurant Name</dt>
                    <dd className="text-gray-900">{formData.name}</dd>
                    <dt className="text-gray-500">Legal Name</dt>
                    <dd className="text-gray-900">{formData.legalName}</dd>
                    <dt className="text-gray-500">Business Type</dt>
                    <dd className="text-gray-900 capitalize">{formData.businessType.replace("_", " ")}</dd>
                    <dt className="text-gray-500">{selectedCountry.taxIdLabel}</dt>
                    <dd className="text-gray-900">{formData.taxId}</dd>
                  </dl>
                </div>

                <hr className="border-gray-200" />

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Location & Contact</h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-gray-500">Address</dt>
                    <dd className="text-gray-900">{formData.address}</dd>
                    <dt className="text-gray-500">City</dt>
                    <dd className="text-gray-900">{formData.city}, {formData.state} {formData.zip}</dd>
                    <dt className="text-gray-500">Country</dt>
                    <dd className="text-gray-900">{selectedCountry.name}</dd>
                    <dt className="text-gray-500">Phone</dt>
                    <dd className="text-gray-900">{formData.phone}</dd>
                    {formData.website && (
                      <>
                        <dt className="text-gray-500">Website</dt>
                        <dd className="text-gray-900">{formData.website}</dd>
                      </>
                    )}
                  </dl>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-600">
                    I agree to the{" "}
                    <a href="/terms" className="text-purple-600 hover:underline" target="_blank">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" className="text-purple-600 hover:underline" target="_blank">
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-800 rounded-lg">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || isLoading}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                {isLoading ? "Saving..." : "Complete Setup"}
              </button>
            )}
          </div>
        </div>

        {/* Step Labels */}
        <div className="mt-6 text-center text-purple-200 text-sm">
          Step {step} of 4:{" "}
          {step === 1
            ? "Business Info"
            : step === 2
            ? "Location & Contact"
            : step === 3
            ? "Branding"
            : "Review & Confirm"}
        </div>
      </div>
    </div>
  );
}

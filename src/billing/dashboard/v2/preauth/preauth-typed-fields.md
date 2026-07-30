# Preauth fields currently typed (EMR gap inventory)

Independent checklist per scenario. Excludes data already extracted or inferred (consent/claim token, intervention code, doctor National ID / ID type / regulation body from provider + HWR).

---

## 1. Normal preauth

| Currently typed / uploaded | HIE field(s) |
| --- | --- |
| ICD-11 *(if not picking a visit diagnosis)* | `diagnoses[].icd_code` |
| Unit price *(if bill price missing/wrong)* | `items[].unit_price` |
| Service start / end *(if defaults need change)* | `service_start`, `service_end` |
| Provider notification email *(if not from session/HWR)* | `provider_notification_email` |
| Attachments (generate or upload) | `attachments[]` + files |

No specialty clinical narrative for Normal.

---

## 2. Surgical preauth

| Currently typed / uploaded | HIE field(s) |
| --- | --- |
| Chief complaint | `chief_complaint` |
| Vital signs | `vital_signs` |
| History of present illness | `history_of_present_illness` |
| Physical examination | `physical_examination` |
| Investigation report details | `investigation_report_details` |
| Type of anaesthesia | `type_of_anaesthesia` |
| Surgery date | `surgery_date` |
| ICD-11 *(if not from visit diagnosis)* | `diagnoses[].icd_code` |
| Unit price *(if needed)* | `items[].unit_price` |
| Service start / end *(if needed)* | `service_start`, `service_end` |
| Provider email *(if needed)* | `provider_notification_email` |
| Attachments | `attachments[]` + files |
| Employment / accident / co-insurance *(optional; not fully wired in UI)* | `is_condition_related_to_employment`, `is_condition_related_to_auto_or_other_accident`, `is_co_insured`, `co_insurance_details` |

---

## 3. Imaging preauth

| Currently typed / uploaded | HIE field(s) |
| --- | --- |
| Clinical indications | `clinical_indications` |
| ICD-11 *(if not from visit diagnosis)* | `diagnoses[].icd_code` |
| Unit price *(if needed)* | `items[].unit_price` |
| Service start / end *(if needed)* | `service_start`, `service_end` |
| Provider email *(if needed)* | `provider_notification_email` |
| Attachments | `attachments[]` + files |

---

## 4. Renal preauth

| Currently typed / uploaded | HIE field(s) |
| --- | --- |
| Number of sessions required | `number_of_sessions_required` |
| Cost per session | `cost_per_session` |
| Frequency of sessions | `frequency_of_sessions` |
| Clinical indications | `clinical_indications` |
| Start date | `start_date` |
| Is co-insured | `is_co_insured` |
| ICD-11 *(if not from visit diagnosis)* | `diagnoses[].icd_code` |
| Unit price *(if needed)* | `items[].unit_price` |
| Service start / end *(if needed)* | `service_start`, `service_end` |
| Provider email *(if needed)* | `provider_notification_email` |
| Attachments | `attachments[]` + files |

---

## 5. Oncology preauth

| Currently typed / uploaded | HIE field(s) |
| --- | --- |
| Carcinoma staging | `carcinoma_staging` |
| Comorbidity | `comorbidity` |
| Metastases | `metastases` |
| Treatment setting | `treatment_setting` |
| Number of sessions required | `number_of_sessions_required` |
| Cost per session | `cost_per_session` |
| Is co-insured | `is_co_insured` |
| ICD-11 *(if not from visit diagnosis)* | `diagnoses[].icd_code` |
| Unit price *(if needed)* | `items[].unit_price` |
| Service start / end *(if needed)* | `service_start`, `service_end` |
| Provider email *(if needed)* | `provider_notification_email` |
| Attachments | `attachments[]` + files |
| Start date / progress report *(docs; start date not fully separate in current UI)* | `start_date`, `progress_report` |

---

## 6. Optical preauth

| Currently typed / uploaded | HIE field(s) |
| --- | --- |
| Necessity of service | `necessity_of_service` |
| Lens prescription | `lens_prescription` |
| Lens amount | `lens_amount` |
| Eye examination amount | `eye_examination_amount` |
| Frame amount | `frame_amount` |
| New or replacement | `new_or_replacement` |
| Clinical indications *(required by HIE; ensure UI captures if not already)* | `clinical_indications` |
| ICD-11 *(if not from visit diagnosis)* | `diagnoses[].icd_code` |
| Unit price *(if needed)* | `items[].unit_price` |
| Service start / end *(if needed)* | `service_start`, `service_end` |
| Provider email *(if needed)* | `provider_notification_email` |
| Attachments | `attachments[]` + files |

---

## Already available (excluded from tables above)

- Consent / claim token
- Intervention code
- Doctor National ID, ID type, regulation body (OpenMRS provider attribute + HWR)

## References

- [Postman HIE Integrations UAT](https://documenter.getpostman.com/view/39260559/2sB3dSPoWf)
- [eClaims Preauths API](https://hie-docs.dha.go.ke/eclaims/preauths)
- [Normal](https://hie-docs.dha.go.ke/docs/claims/process/preauths/normalPreauths) · [Surgical](https://hie-docs.dha.go.ke/docs/claims/process/preauths/surgicalPreauths) · [Imaging](https://hie-docs.dha.go.ke/docs/claims/process/preauths/imagingPreauth) · [Renal](https://hie-docs.dha.go.ke/docs/claims/process/preauths/renalPreauth) · [Oncology](https://hie-docs.dha.go.ke/docs/claims/process/preauths/oncologyPreauth) · [Optical](https://hie-docs.dha.go.ke/docs/claims/process/preauths/opticalPreauth)

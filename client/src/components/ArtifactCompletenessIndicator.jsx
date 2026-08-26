const ARTIFACT_LABELS = [
  { key: 'jobDescription', label: 'JD' },
  { key: 'fitAnalysis', label: 'Fit' },
  { key: 'cv', label: 'CV' },
  { key: 'coverLetter', label: 'CL' },
  { key: 'companyProfileLocal', label: 'CoProf' },
]

export default function ArtifactCompletenessIndicator({ artifacts }) {
  return (
    <div className="artifact-dots" title="Job Description / Fit Analysis / CV / Cover Letter / local Company Profile">
      {ARTIFACT_LABELS.map(({ key, label }) => (
        <span
          key={key}
          className={`artifact-dot ${artifacts?.[key] ? 'artifact-dot--present' : 'artifact-dot--missing'}`}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

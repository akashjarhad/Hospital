/**
 * FHIR-oriented prototype mapper.
 * Produces resource-like JSON for interoperability demonstrations; it does not claim formal FHIR conformance.
 */

function toFHIRPatient(patient) {
  if (!patient) return null;
  const nameParts = (patient.name || '').split(' ');
  const familyName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  const givenNames = nameParts.length > 1 ? nameParts.slice(0, -1) : nameParts;

  const resource = {
    resourceType: 'Patient',
    id: `pat-${patient.id}`,
    active: true
  };
  if (patient.unique_health_id) resource.identifier = [{ system: 'https://healthid.ndhm.gov.in/abha', value: patient.unique_health_id, use: 'official' }];
  if (patient.name) resource.name = [{ use: 'official', text: patient.name, family: familyName, given: givenNames }];
  if (patient.phone) resource.telecom = [{ system: 'phone', value: patient.phone, use: 'mobile' }];
  if (patient.gender) resource.gender = patient.gender.toLowerCase();
  if (patient.dob) resource.birthDate = patient.dob;
  if (patient.emergency_contact_name) resource.contact = [{ relationship: [{ text: 'Emergency Contact' }], name: { text: patient.emergency_contact_name }, telecom: patient.emergency_contact_phone ? [{ system: 'phone', value: patient.emergency_contact_phone }] : [] }];
  return resource;
}

function toFHIROrganization(hospital) {
  if (!hospital) return null;
  return {
    resourceType: 'Organization',
    id: `org-${hospital.id}`,
    identifier: [
      {
        system: 'https://registry.hospital.in/node-id',
        value: hospital.code
      }
    ],
    name: hospital.name,
    telecom: [
      { system: 'phone', value: hospital.phone || hospital.emergency_contact }
    ],
    address: [
      {
        line: [hospital.address],
        city: hospital.city
      }
    ]
  };
}

function toFHIRPractitioner(doctor) {
  if (!doctor) return null;
  return {
    resourceType: 'Practitioner',
    id: `doc-${doctor.id}`,
    identifier: doctor.license_number ? [
      {
        system: 'https://mciindia.org/license',
        value: doctor.license_number
      }
    ] : [],
    name: [{ text: doctor.name }],
    telecom: [{ system: 'email', value: doctor.email }],
    qualification: doctor.specialty ? [
      { code: { text: doctor.specialty } }
    ] : []
  };
}

function toFHIRConsent(consent, patient, reqHosp, recHosp) {
  if (!consent) return null;
  return {
    resourceType: 'Consent',
    id: `consent-${consent.id}`,
    status: consent.status.toLowerCase(),
    scope: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/consentscope',
        code: 'patient-privacy',
        display: 'Privacy Consent'
      }]
    },
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'INFA',
        display: 'Information Access'
      }]
    }],
    patient: {
      reference: `Patient/pat-${consent.patient_id}`,
      display: patient ? patient.name : `Patient #${consent.patient_id}`
    },
    dateTime: consent.granted_at || consent.created_at,
    performer: [
      { reference: `Patient/pat-${consent.patient_id}` }
    ],
    organization: [
      { reference: `Organization/org-${consent.requesting_hospital_id}`, display: reqHosp?.name },
      { reference: `Organization/org-${consent.receiving_hospital_id}`, display: recHosp?.name }
    ],
    provision: {
      type: consent.status === 'GRANTED' ? 'permit' : 'deny',
      period: {
        start: consent.granted_at,
        end: consent.expires_at
      },
      purpose: [{ code: consent.purpose || 'TRANSFER_FOR_SPECIALIZED_TREATMENT' }],
      class: (consent.data_categories || []).map(cat => ({
        system: 'http://medtransfer.internal/categories',
        code: cat
      }))
    }
  };
}

function toFHIRBundle(transfer, patient, fromHosp, toHosp, reqDoc, recDoc, clinicalData, consent) {
  const entries = [];

  if (patient) {
    entries.push({
      fullUrl: `urn:uuid:patient-${patient.id}`,
      resource: toFHIRPatient(patient)
    });
  }

  if (fromHosp) {
    entries.push({
      fullUrl: `urn:uuid:org-${fromHosp.id}`,
      resource: toFHIROrganization(fromHosp)
    });
  }

  if (toHosp) {
    entries.push({
      fullUrl: `urn:uuid:org-${toHosp.id}`,
      resource: toFHIROrganization(toHosp)
    });
  }

  if (reqDoc) {
    entries.push({
      fullUrl: `urn:uuid:doc-${reqDoc.id}`,
      resource: toFHIRPractitioner(reqDoc)
    });
  }

  if (recDoc) {
    entries.push({
      fullUrl: `urn:uuid:doc-${recDoc.id}`,
      resource: toFHIRPractitioner(recDoc)
    });
  }

  if (consent) {
    entries.push({
      fullUrl: `urn:uuid:consent-${consent.id}`,
      resource: toFHIRConsent(consent, patient, fromHosp, toHosp)
    });
  }

  // Authorized resource-like diagnostic / observation records.
  const authorizedTests = clinicalData && Array.isArray(clinicalData.visits)
    ? clinicalData.visits.flatMap(visit => visit.tests || [])
    : [];
  authorizedTests.forEach((test, idx) => {
    const resourceType = /imag|radio|scan|x-ray/i.test(test.category || '') ? 'DiagnosticReport' : 'Observation';
    entries.push({
      fullUrl: `urn:uuid:${resourceType.toLowerCase()}-${test.id || idx}`,
      resource: {
        resourceType,
        id: `${resourceType === 'Observation' ? 'obs' : 'report'}-${test.id || idx}`,
        status: 'final',
        category: [{ text: test.category || 'Diagnostic' }],
        code: { text: test.test_name },
        subject: { reference: `Patient/pat-${patient.id}` },
        effectiveDateTime: test.timestamp,
        valueString: `${test.result} ${test.units || ''}`.trim(),
        interpretation: test.abnormal ? [{ text: 'Source record marked abnormal' }] : [],
        note: test.notes ? [{ text: test.notes }] : []
      }
    });
  });

  return {
    resourceType: 'Bundle',
    id: `bundle-${transfer.transfer_code || transfer.id}`,
    type: 'document',
    timestamp: new Date().toISOString(),
    meta: {
      tag: [{ system: 'http://medtransfer.internal/prototype', code: 'fhir-oriented', display: 'FHIR-oriented prototype; not formally validated' }],
      security: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
          code: 'R',
          display: 'Restricted'
        }
      ]
    },
    entry: entries
  };
}

module.exports = {
  toFHIRPatient,
  toFHIROrganization,
  toFHIRPractitioner,
  toFHIRConsent,
  toFHIRBundle
};

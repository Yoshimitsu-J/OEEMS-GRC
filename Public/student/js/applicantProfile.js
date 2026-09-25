/* =========================================
   APPLICANT PROFILE — form save/restore
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Applicant Profile JS Initialized.');

  const savedData = JSON.parse(localStorage.getItem('applicantData') || '{}');

  const sexInputs = document.querySelectorAll('input[name="sex"]');
  const birthdayInput = document.getElementById('birthday');
  const phoneInput = document.getElementById('phone');
  const regionSelect = document.getElementById('region');
  const citySelect = document.getElementById('city');

  if (savedData.sex) {
    sexInputs.forEach((input) => {
      if (input.value === savedData.sex) input.checked = true;
    });
  }
  if (savedData.birthday && birthdayInput) birthdayInput.value = savedData.birthday;
  if (savedData.phone && phoneInput) phoneInput.value = savedData.phone;
  if (savedData.region && regionSelect) regionSelect.value = savedData.region;
  if (savedData.city && citySelect) citySelect.value = savedData.city;

  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', () => {
      const formData = {
        sex: document.querySelector('input[name="sex"]:checked')?.value || '',
        birthday: birthdayInput?.value || '',
        phone: phoneInput?.value || '',
        region: regionSelect?.value || '',
        city: citySelect?.value || ''
      };
      localStorage.setItem('applicantData', JSON.stringify(formData));
    });
  }
});
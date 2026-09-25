/* =========================================
   SET-UP ACCOUNT — Multi-step form
   WITH Dynamic Country/Region/City/Barangay
   AND Terms & Conditions Modal
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Set-Up Account JS Initialized.');

  // =========================================
  // DYNAMIC ADDRESS DATA (Philippines)
  // =========================================
  const addressData = {
    'Philippines': {
      'NCR - National Capital Region': {
        'Caloocan City': [
          'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5',
          'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Barangay 10',
          'Barangay 11', 'Barangay 12', 'Barangay 13', 'Barangay 14', 'Barangay 15',
          'Barangay 16', 'Barangay 17', 'Barangay 18', 'Barangay 19', 'Barangay 20',
          'Barangay 21', 'Barangay 22', 'Barangay 23', 'Barangay 24', 'Barangay 25',
          'Barangay 26', 'Barangay 27', 'Barangay 28', 'Barangay 29', 'Barangay 30',
          'Barangay 31', 'Barangay 32', 'Barangay 33', 'Barangay 34', 'Barangay 35',
          'Barangay 36', 'Barangay 37', 'Barangay 38', 'Barangay 39', 'Barangay 40',
          'Barangay 41', 'Barangay 42', 'Barangay 43', 'Barangay 44', 'Barangay 45',
          'Barangay 46', 'Barangay 47', 'Barangay 48', 'Barangay 49', 'Barangay 50',
          'Barangay 51', 'Barangay 52', 'Barangay 53', 'Barangay 54', 'Barangay 55',
          'Barangay 56', 'Barangay 57', 'Barangay 58', 'Barangay 59', 'Barangay 60',
          'Barangay 61', 'Barangay 62', 'Barangay 63', 'Barangay 64', 'Barangay 65',
          'Barangay 66', 'Barangay 67', 'Barangay 68', 'Barangay 69', 'Barangay 70',
          'Barangay 71', 'Barangay 72', 'Barangay 73', 'Barangay 74', 'Barangay 75',
          'Barangay 76', 'Barangay 77', 'Barangay 78', 'Barangay 79', 'Barangay 80',
          'Barangay 81', 'Barangay 82', 'Barangay 83', 'Barangay 84', 'Barangay 85',
          'Barangay 86', 'Barangay 87', 'Barangay 88', 'Barangay 89', 'Barangay 90',
          'Barangay 91', 'Barangay 92', 'Barangay 93', 'Barangay 94', 'Barangay 95',
          'Barangay 96', 'Barangay 97', 'Barangay 98', 'Barangay 99', 'Barangay 100',
          'Barangay 101', 'Barangay 102', 'Barangay 103', 'Barangay 104', 'Barangay 105',
          'Barangay 106', 'Barangay 107', 'Barangay 108', 'Barangay 109', 'Barangay 110',
          'Barangay 111', 'Barangay 112', 'Barangay 113', 'Barangay 114', 'Barangay 115',
          'Barangay 116', 'Barangay 117', 'Barangay 118', 'Barangay 119', 'Barangay 120',
          'Barangay 121', 'Barangay 122', 'Barangay 123', 'Barangay 124', 'Barangay 125',
          'Barangay 126', 'Barangay 127', 'Barangay 128', 'Barangay 129', 'Barangay 130',
          'Barangay 131', 'Barangay 132', 'Barangay 133', 'Barangay 134', 'Barangay 135',
          'Barangay 136', 'Barangay 137', 'Barangay 138', 'Barangay 139', 'Barangay 140',
          'Barangay 141', 'Barangay 142', 'Barangay 143', 'Barangay 144', 'Barangay 145',
          'Barangay 146', 'Barangay 147', 'Barangay 148', 'Barangay 149', 'Barangay 150',
          'Barangay 151', 'Barangay 152', 'Barangay 153', 'Barangay 154', 'Barangay 155',
          'Barangay 156', 'Barangay 157', 'Barangay 158', 'Barangay 159', 'Barangay 160',
          'Barangay 161', 'Barangay 162', 'Barangay 163', 'Barangay 164', 'Barangay 165',
          'Barangay 166', 'Barangay 167', 'Barangay 168', 'Barangay 169', 'Barangay 170',
          'Barangay 171', 'Barangay 172', 'Barangay 173', 'Barangay 174', 'Barangay 175',
          'Barangay 176', 'Barangay 177', 'Barangay 178', 'Barangay 179', 'Barangay 180',
          'Barangay 181', 'Barangay 182', 'Barangay 183', 'Barangay 184', 'Barangay 185',
          'Barangay 186', 'Barangay 187', 'Barangay 188'
        ],
        'Malabon City': [
          'Barangay Acacia', 'Barangay Baritan', 'Barangay Bayan-bayanan',
          'Barangay Catmon', 'Barangay Concepcion', 'Barangay Dampalit',
          'Barangay Flores', 'Barangay Hulong Duhat', 'Barangay Ibaba',
          'Barangay Longos', 'Barangay Maysilo', 'Barangay Muzon',
          'Barangay Niugan', 'Barangay Panghulo',
          'Barangay Potrero', 'Barangay San Agustin', 'Barangay Santolan',
          'Barangay Tañong', 'Barangay Tinajeros', 'Barangay Tonsuya',
          'Barangay Tugatog'
        ],
        'Navotas City': [
          'Barangay Bagumbayan North', 'Barangay Bagumbayan South',
          'Barangay Bangculasi', 'Barangay Daanghari', 'Barangay Navotas East',
          'Barangay Navotas West', 'Barangay North Bay Boulevard North',
          'Barangay North Bay Boulevard South', 'Barangay San Jose',
          'Barangay San Rafael Village', 'Barangay San Roque',
          'Barangay Sipac-Almacen', 'Barangay Tangos North',
          'Barangay Tangos South', 'Barangay Tanza 1', 'Barangay Tanza 2'
        ],
        'Valenzuela City': [
          'Barangay Arkong Bato', 'Barangay Bagbaguin', 'Barangay Balangkas',
          'Barangay Bignay', 'Barangay Bisig', 'Barangay Canumay East',
          'Barangay Canumay West', 'Barangay Coloong', 'Barangay Dalandanan',
          'Barangay Gen. T. de Leon', 'Barangay Isla', 'Barangay Karuhatan',
          'Barangay Lawang Bato', 'Barangay Lingunan', 'Barangay Mabolo',
          'Barangay Malanday', 'Barangay Malinta', 'Barangay Mapulang Lupa',
          'Barangay Marulas', 'Barangay Maysan', 'Barangay Parada',
          'Barangay Pariancillo Villa', 'Barangay Paso de Blas',
          'Barangay Pasolo', 'Barangay Poblacion', 'Barangay Pulo',
          'Barangay Punturin', 'Barangay Rincon', 'Barangay Tagalag',
          'Barangay Ugong', 'Barangay Viente Reales', 'Barangay Wawang Pulo'
        ],
        'Manila': [
          'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5',
          'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Barangay 10',
          'Barangay 11', 'Barangay 12', 'Barangay 13', 'Barangay 14', 'Barangay 15',
          'Barangay 16', 'Barangay 17', 'Barangay 18', 'Barangay 19', 'Barangay 20',
          'Barangay 21', 'Barangay 22', 'Barangay 23', 'Barangay 24', 'Barangay 25',
          'Barangay 26', 'Barangay 27', 'Barangay 28', 'Barangay 29', 'Barangay 30',
          'Barangay 31', 'Barangay 32', 'Barangay 33', 'Barangay 34', 'Barangay 35',
          'Barangay 36', 'Barangay 37', 'Barangay 38', 'Barangay 39', 'Barangay 40',
          'Barangay 41', 'Barangay 42', 'Barangay 43', 'Barangay 44', 'Barangay 45',
          'Barangay 46', 'Barangay 47', 'Barangay 48', 'Barangay 49', 'Barangay 50',
          'Barangay 51', 'Barangay 52', 'Barangay 53', 'Barangay 54', 'Barangay 55',
          'Barangay 56', 'Barangay 57', 'Barangay 58', 'Barangay 59', 'Barangay 60',
          'Barangay 61', 'Barangay 62', 'Barangay 63', 'Barangay 64', 'Barangay 65',
          'Barangay 66', 'Barangay 67', 'Barangay 68', 'Barangay 69', 'Barangay 70',
          'Barangay 71', 'Barangay 72', 'Barangay 73', 'Barangay 74', 'Barangay 75',
          'Barangay 76', 'Barangay 77', 'Barangay 78', 'Barangay 79', 'Barangay 80',
          'Barangay 81', 'Barangay 82', 'Barangay 83', 'Barangay 84', 'Barangay 85',
          'Barangay 86', 'Barangay 87', 'Barangay 88', 'Barangay 89', 'Barangay 90',
          'Barangay 91', 'Barangay 92', 'Barangay 93', 'Barangay 94', 'Barangay 95',
          'Barangay 96', 'Barangay 97', 'Barangay 98', 'Barangay 99', 'Barangay 100',
          'Barangay 101', 'Barangay 102', 'Barangay 103', 'Barangay 104', 'Barangay 105',
          'Barangay 106', 'Barangay 107', 'Barangay 108', 'Barangay 109', 'Barangay 110',
          'Barangay 111', 'Barangay 112', 'Barangay 113', 'Barangay 114', 'Barangay 115',
          'Barangay 116', 'Barangay 117', 'Barangay 118', 'Barangay 119', 'Barangay 120',
          'Barangay 121', 'Barangay 122', 'Barangay 123', 'Barangay 124', 'Barangay 125',
          'Barangay 126', 'Barangay 127', 'Barangay 128', 'Barangay 129', 'Barangay 130',
          'Barangay 131', 'Barangay 132', 'Barangay 133', 'Barangay 134', 'Barangay 135',
          'Barangay 136', 'Barangay 137', 'Barangay 138', 'Barangay 139', 'Barangay 140',
          'Barangay 141', 'Barangay 142', 'Barangay 143', 'Barangay 144', 'Barangay 145',
          'Barangay 146', 'Barangay 147', 'Barangay 148', 'Barangay 149', 'Barangay 150',
          'Barangay 151', 'Barangay 152', 'Barangay 153', 'Barangay 154', 'Barangay 155',
          'Barangay 156', 'Barangay 157', 'Barangay 158', 'Barangay 159', 'Barangay 160',
          'Barangay 161', 'Barangay 162', 'Barangay 163', 'Barangay 164', 'Barangay 165',
          'Barangay 166', 'Barangay 167', 'Barangay 168', 'Barangay 169', 'Barangay 170',
          'Barangay 171', 'Barangay 172', 'Barangay 173', 'Barangay 174', 'Barangay 175',
          'Barangay 176', 'Barangay 177', 'Barangay 178', 'Barangay 179', 'Barangay 180',
          'Barangay 181', 'Barangay 182', 'Barangay 183', 'Barangay 184', 'Barangay 185',
          'Barangay 186', 'Barangay 187', 'Barangay 188', 'Barangay 189', 'Barangay 190',
          'Barangay 191', 'Barangay 192', 'Barangay 193', 'Barangay 194', 'Barangay 195',
          'Barangay 196', 'Barangay 197', 'Barangay 198', 'Barangay 199', 'Barangay 200'
        ]
      },
      'Region III - Central Luzon': {
        'Angeles City': [
          'Barangay Agapito del Rosario', 'Barangay Amsic', 'Barangay Anunas',
          'Barangay Balibago', 'Barangay Capaya', 'Barangay Claro M. Recto',
          'Barangay Cuayan', 'Barangay Cutcut', 'Barangay Cutud',
          'Barangay Lourdes North West', 'Barangay Lourdes Sur',
          'Barangay Lourdes Sur East', 'Barangay Malabañas',
          'Barangay Margot', 'Barangay Mining', 'Barangay Pampang',
          'Barangay Pandan', 'Barangay Pulung Bulu', 'Barangay Pulung Cacutud',
          'Barangay Pulung Maragul', 'Barangay Salapungan', 'Barangay San Jose',
          'Barangay San Nicolas', 'Barangay Santa Teresita', 'Barangay Santa Trinidad',
          'Barangay Santo Cristo', 'Barangay Santo Domingo', 'Barangay Santo Rosario',
          'Barangay Sapalibutad', 'Barangay Sapangbato', 'Barangay Tabun',
          'Barangay Virgen Delos Remedios'
        ],
        'Bulacan': [
          'Barangay Bagumbayan', 'Barangay Bambang', 'Barangay Matungao',
          'Barangay Maysantol', 'Barangay Perez', 'Barangay Pitpitan',
          'Barangay San Nicolas', 'Barangay Sta. Ana', 'Barangay Taliptip',
          'Barangay Tibig', 'Barangay Tuktukan'
        ]
      },
      'Region IV-A - CALABARZON': {
        'Antipolo City': [
          'Barangay Bagong Nayon', 'Barangay Beverly Hills',
          'Barangay Calawis', 'Barangay Cupang', 'Barangay Dalig',
          'Barangay Dela Paz', 'Barangay Inarawan', 'Barangay Mambugan',
          'Barangay Mayamot', 'Barangay Muntingdilaw', 'Barangay San Isidro',
          'Barangay San Jose', 'Barangay San Juan', 'Barangay San Luis',
          'Barangay San Roque', 'Barangay Santa Cruz'
        ],
        'Bacoor City': [
          'Barangay Alima', 'Barangay Aniban 1', 'Barangay Aniban 2',
          'Barangay Aniban 3', 'Barangay Aniban 4', 'Barangay Aniban 5',
          'Barangay Banalo', 'Barangay Bayanan', 'Barangay Campo Santo',
          'Barangay Daang Bukid', 'Barangay Digman', 'Barangay Dulong Bayan',
          'Barangay Habay 1', 'Barangay Habay 2', 'Barangay Kaingin',
          'Barangay Ligas 1', 'Barangay Ligas 2', 'Barangay Ligas 3',
          'Barangay Mabolo 1', 'Barangay Mabolo 2', 'Barangay Mabolo 3',
          'Barangay Maliksi 1', 'Barangay Maliksi 2', 'Barangay Maliksi 3',
          'Barangay Mambog 1', 'Barangay Mambog 2', 'Barangay Mambog 3',
          'Barangay Mambog 4', 'Barangay Mambog 5', 'Barangay Molino 1',
          'Barangay Molino 2', 'Barangay Molino 3', 'Barangay Molino 4',
          'Barangay Molino 5', 'Barangay Molino 6', 'Barangay Molino 7',
          'Barangay Niog 1', 'Barangay Niog 2', 'Barangay Niog 3',
          'Barangay Panapaan 1', 'Barangay Panapaan 2', 'Barangay Panapaan 3',
          'Barangay Panapaan 4', 'Barangay Panapaan 5', 'Barangay Panapaan 6',
          'Barangay Panapaan 7', 'Barangay Poblacion', 'Barangay Queens Row Central',
          'Barangay Queens Row East', 'Barangay Queens Row West',
          'Barangay Real 1', 'Barangay Real 2', 'Barangay Salinas 1',
          'Barangay Salinas 2', 'Barangay Salinas 3', 'Barangay Salinas 4',
          'Barangay San Nicolas 1', 'Barangay San Nicolas 2', 'Barangay San Nicolas 3',
          'Barangay Sineguelasan', 'Barangay Tabing Dagat', 'Barangay Talaba 1',
          'Barangay Talaba 2', 'Barangay Talaba 3', 'Barangay Talaba 4',
          'Barangay Talaba 5', 'Barangay Talaba 6', 'Barangay Talaba 7',
          'Barangay Zapote 1', 'Barangay Zapote 2', 'Barangay Zapote 3',
          'Barangay Zapote 4', 'Barangay Zapote 5'
        ]
      }
    }
  };

  // =========================================
  // STEP 1: Personal Information
  // =========================================
  const setUpForm = document.getElementById('setUpForm');
  const setUpMessage = document.getElementById('setUpMessage');

  if (setUpForm) {
    setUpForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const lastName = document.getElementById('lastName').value.trim();
      const givenName = document.getElementById('givenName').value.trim();
      const middleName = document.getElementById('middleName').value.trim();

      if (!lastName || !givenName) {
        setUpMessage.textContent = 'Please fill in Last Name and Given Name.';
        setUpMessage.style.color = '#ff6b6b';
        return;
      }

      localStorage.setItem('accountInfo', JSON.stringify({
        lastName, givenName, middleName
      }));

      setUpMessage.textContent = 'Info saved! Proceeding...';
      setUpMessage.style.color = '#4dd08a';

      setTimeout(() => {
        document.getElementById('setupCard').classList.add('hidden');
        document.getElementById('studentInfoCard').classList.remove('hidden');
        initAddressDropdowns();
      }, 800);
    });
  }

  // =========================================
  // STEP 2: Student Information
  // =========================================
  const studentInfoForm = document.getElementById('studentInfoForm');
  const studentInfoMessage = document.getElementById('studentInfoMessage');

  // =========================================
  // DYNAMIC ADDRESS DROPDOWNS
  // =========================================
  function initAddressDropdowns() {
    const countrySelect = document.getElementById('country');
    const regionSelect = document.getElementById('region');
    const citySelect = document.getElementById('city');
    const barangaySelect = document.getElementById('barangay');

    if (!countrySelect) return;

    // ✅ COUNTRY — Populate
    countrySelect.innerHTML = '<option value="">Select Country</option>';
    Object.keys(addressData).forEach((country) => {
      const opt = document.createElement('option');
      opt.value = country;
      opt.textContent = country;
      countrySelect.appendChild(opt);
    });

    // ✅ COUNTRY CHANGE — Populate Region
    countrySelect.addEventListener('change', () => {
      const country = countrySelect.value;

      // Reset region, city, barangay
      regionSelect.innerHTML = '<option value="">Select Region</option>';
      citySelect.innerHTML = '<option value="">Select City</option>';
      barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
      citySelect.disabled = true;
      barangaySelect.disabled = true;

      if (!country || !addressData[country]) {
        regionSelect.disabled = true;
        return;
      }

      // Populate regions
      regionSelect.disabled = false;
      Object.keys(addressData[country]).forEach((region) => {
        const opt = document.createElement('option');
        opt.value = region;
        opt.textContent = region;
        regionSelect.appendChild(opt);
      });
    });

    // ✅ REGION CHANGE — Populate City
    regionSelect.addEventListener('change', () => {
      const country = countrySelect.value;
      const region = regionSelect.value;

      citySelect.innerHTML = '<option value="">Select City</option>';
      barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
      barangaySelect.disabled = true;

      if (!country || !region || !addressData[country] || !addressData[country][region]) {
        citySelect.disabled = true;
        return;
      }

      citySelect.disabled = false;
      Object.keys(addressData[country][region]).forEach((city) => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.textContent = city;
        citySelect.appendChild(opt);
      });
    });

    // ✅ CITY CHANGE — Populate Barangay
    citySelect.addEventListener('change', () => {
      const country = countrySelect.value;
      const region = regionSelect.value;
      const city = citySelect.value;

      barangaySelect.innerHTML = '<option value="">Select Barangay</option>';

      if (!country || !region || !city || !addressData[country] || !addressData[country][region] || !addressData[country][region][city]) {
        barangaySelect.disabled = true;
        return;
      }

      barangaySelect.disabled = false;
      addressData[country][region][city].forEach((barangay) => {
        const opt = document.createElement('option');
        opt.value = barangay;
        opt.textContent = barangay;
        barangaySelect.appendChild(opt);
      });
    });
  }

    // =========================================
  // TERMS & CONDITIONS MODAL
  // =========================================
  const termsModal = document.getElementById('termsModal');
  const openTermsBtn = document.getElementById('openTerms');
  const closeTermsBtn = document.getElementById('closeTerms');
  const acceptTermsBtn = document.getElementById('acceptTerms');
  const declineTermsBtn = document.getElementById('declineTerms');
  const termsCheck = document.getElementById('termsCheck');

  // ✅ I-disable ang checkbox by default
  // (para hindi ito ma-check nang hindi dumadaan sa "I AGREE")
  if (termsCheck) {
    termsCheck.disabled = true;
    termsCheck.checked = false;
  }

  // ✅ Buksan ang Terms modal
  if (openTermsBtn && termsModal) {
    openTermsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      termsModal.classList.remove('hidden');
    });
  }

  // ✅ Isara ang Terms modal (X button)
  if (closeTermsBtn && termsModal) {
    closeTermsBtn.addEventListener('click', () => {
      termsModal.classList.add('hidden');
    });
  }

  // ✅ I AGREE — dito lang mache-check ang checkbox
  if (acceptTermsBtn && termsModal) {
    acceptTermsBtn.addEventListener('click', () => {
      if (termsCheck) {
        termsCheck.disabled = false;   // i-enable muna
        termsCheck.checked = true;     // saka i-check
        termsCheck.disabled = true;    // i-disable ulit para hindi ma-uncheck manually
      }
      termsModal.classList.add('hidden');
    });
  }

  // ✅ DECLINE — hindi mache-check ang checkbox
  if (declineTermsBtn && termsModal) {
    declineTermsBtn.addEventListener('click', () => {
      if (termsCheck) {
        termsCheck.checked = false;
        termsCheck.disabled = true;
      }
      termsModal.classList.add('hidden');
    });
  }

  // ✅ Isara ang modal kapag clinick ang labas
  if (termsModal) {
    termsModal.addEventListener('click', (e) => {
      if (e.target === termsModal) {
        termsModal.classList.add('hidden');
      }
    });
  }

  // =========================================
  // STUDENT INFO FORM SUBMIT
  // =========================================
  if (studentInfoForm) {
    studentInfoForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const sex = document.querySelector('input[name="sex"]:checked')?.value;
      const birthday = document.getElementById('birthday').value;
      const phone = document.getElementById('phone').value;
      const country = document.getElementById('country').value;
      const region = document.getElementById('region').value;
      const city = document.getElementById('city').value;
      const barangay = document.getElementById('barangay').value;
      const streetAddress = document.getElementById('streetAddress').value;
      const guardianName = document.getElementById('guardianName').value;
      const guardianPhone = document.getElementById('guardianPhone').value;
      const termsAccepted = document.getElementById('termsCheck').checked;

      if (!sex || !birthday || !country || !region || !city || !barangay || !streetAddress || !guardianName || !guardianPhone) {
        studentInfoMessage.textContent = 'Please fill in all required fields.';
        studentInfoMessage.style.color = '#ff6b6b';
        return;
      }

      if (!termsAccepted) {
        studentInfoMessage.textContent = 'You must agree to Terms & Conditions.';
        studentInfoMessage.style.color = '#ff6b6b';
        return;
      }

      // Save student info
      localStorage.setItem('studentInfo', JSON.stringify({
        sex, birthday, phone, country, region, city, barangay,
        streetAddress, guardianName, guardianPhone
      }));

      // Combine
      const accountInfo = JSON.parse(localStorage.getItem('accountInfo') || '{}');
      const fullData = {
        ...accountInfo,
        sex, birthday, phone, country, region, city, barangay,
        streetAddress, guardianName, guardianPhone
      };
      localStorage.setItem('applicantData', JSON.stringify(fullData));

      studentInfoMessage.textContent = 'Registration complete! Redirecting...';
      studentInfoMessage.style.color = '#4dd08a';

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    });
  }
});
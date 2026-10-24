# KMC Hospital App (React Native / Expo)

Hindi + English hospital app for **KMC Hospital, Jankipuram, Lucknow**
(https://kmchospitallucknow.in/), built with React Native + Expo.

## Kaise chalayein (How to run)

```bash
cd KMCHospitalApp
npm install
npx expo start
```

- `npx expo start` ke baad QR code scan karke Expo Go app (Android/iOS) me khol sakte ho.
- Ya `npm run android` / `npm run ios` se emulator me chalao.
- Chalane se pehle `assets/` folder me icon.png, splash.png, adaptive-icon.png, favicon.png daal dena (assets/README.txt me detail hai).

## App Workflow (jaisa aapne bataya)

1. **Login/Signup** → Mobile number enter karke OTP se login
2. **OTP Verification**
3. **Language Selection** → Hindi / English
4. **Create Profile** → Full Name, Gender, DOB, Mobile Number, Blood Group
5. **Welcome/Home Screen**
   - Header: Logo, Notification bell, Profile icon
   - Search bar
   - Book Appointment banner (Book Now)
   - Quick Services (Maternity, NICU/PICU, Surgery, Pharmacy, Home Care, etc. — from kmchospitallucknow.in)
   - Upcoming Appointments (jab user appointment book kare tabhi dikhega)
   - Departments section (home par 6 dikhte hai + "View All")
   - Top Doctors (horizontal scroll)
   - Health Tips
   - Emergency Helpline card (call button)
6. **Bottom Tabs**: Home, Department, Appointment, Video Consult

## Folder Structure

```
KMCHospitalApp/
├── App.js                       # Entry point, wraps providers + navigator
├── app.json                     # Expo config
├── babel.config.js
├── package.json
├── assets/                      # App icons/splash (add your own images)
└── src/
    ├── constants/
    │   ├── colors.js             # Color palette
    │   ├── strings.js            # Hindi/English translations
    │   └── data.js                # Departments, doctors, services, health tips (static/demo data)
    ├── context/
    │   ├── AuthContext.js         # Phone/OTP login state, profile
    │   └── LanguageContext.js     # Hindi/English switch
    ├── utils/
    │   └── validators.js          # Mobile/OTP/name validation
    ├── components/                 # Reusable UI building blocks
    │   ├── CustomButton.js
    │   ├── CustomInput.js
    │   ├── Header.js
    │   ├── SearchBar.js
    │   ├── QuickServiceCard.js
    │   ├── DepartmentCard.js
    │   ├── DoctorCard.js
    │   ├── HealthTipCard.js
    │   ├── EmergencyCard.js
    │   └── AppointmentCard.js
    ├── screens/
    │   ├── Auth/
    │   │   ├── LoginScreen.js           # Phone number entry
    │   │   ├── OTPScreen.js             # OTP verification
    │   │   ├── LanguageSelectScreen.js  # Hindi / English
    │   │   └── CreateProfileScreen.js   # Name, Gender, DOB, Mobile, Blood group
    │   └── Main/
    │       ├── HomeScreen.js            # Welcome/dashboard screen
    │       ├── DepartmentListScreen.js  # "View All" departments
    │       ├── DoctorProfileScreen.js   # Doctor detail + book
    │       ├── BookAppointmentScreen.js # Department -> Doctor -> Date -> Slot
    │       ├── AppointmentScreen.js     # Appointment tab (upcoming/past)
    │       ├── VideoConsultScreen.js    # Video Consult tab
    │       ├── NotificationScreen.js
    │       └── ProfileScreen.js
    └── navigation/
        ├── AppNavigator.js       # Root navigator (Auth vs Main)
        ├── AuthNavigator.js      # Login -> OTP -> Language -> Profile
        └── MainTabNavigator.js   # Bottom tabs: Home, Department, Appointment, Video Consult
```

## Next Steps / TODO (Backend integration)

- [ ] Replace mock OTP logic in `AuthContext.js` with a real SMS/OTP provider (Firebase Auth, MSG91, 2Factor, etc.)
- [ ] Replace static arrays in `constants/data.js` with real API calls (departments, doctors, services, health tips)
- [ ] Hook up real appointment booking + payment (if applicable) in `BookAppointmentScreen.js`
- [ ] Add push notifications for appointment reminders (`expo-notifications`)
- [ ] Add a proper date picker for DOB in `CreateProfileScreen.js` (e.g. `@react-native-community/datetimepicker`)
- [ ] Add real doctor photos, hospital images (currently using initials/icons as placeholders)
- [ ] Add video calling SDK for Video Consult tab (e.g. Agora, Twilio, or WebRTC)
- [ ] Add app icon/splash assets in `assets/`

## Notes

- Emergency numbers, address, and departments/doctors data are modeled on the
  publicly visible content of https://kmchospitallucknow.in/ — verify and
  update with the hospital's latest data before production release.
- Colors and layout can be customized in `src/constants/colors.js`.
- All text is centralized in `src/constants/strings.js` for easy Hindi/English editing — add more languages by adding a new key (e.g. `"ur"`) and importing it wherever `useLanguage()` is used.

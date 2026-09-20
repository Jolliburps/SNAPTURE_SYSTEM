# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm.cmd install
   ```

2. Start the app

   ```bash
   & ".\node_modules\.bin\expo.cmd" start
   ```

## Run SNAPTURE with the local ML API

The machine-learning API runs from the separate `SNAPTURE_ML` folder. `localhost` refers to the device itself, so another phone or computer must use the LAN address of the computer running the API.

Start the API in one PowerShell terminal:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_ML"
.\.venv\Scripts\python.exe -m uvicorn scripts.api_server:app --host 0.0.0.0 --port 8000
```

Start Expo/Metro in a second terminal:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE"
& ".\node_modules\.bin\expo.cmd" start --lan --clear
```

For the current computer (`192.168.1.171`):

- Use `http://localhost:8081` only on the computer running Metro.
- Use `http://192.168.1.171:8081` from another computer or a phone browser.
- A plain HTTP LAN page cannot request live browser camera permission. On that
  page, use **Choose / Take Photo** to open the device photo/camera picker; use
  Expo Go or an HTTPS URL when live camera preview is required.
- On iPhone, sign in to Expo Go with the same Expo account as Expo CLI, then scan the LAN QR code.
- Keep all devices on the same Wi-Fi/LAN. The app uses port `8000` for predictions and port `8081` for Metro.

The API host is inferred automatically during development from the browser/Expo host when possible. `.env` remains the explicit fallback; update its IP if the computer changes networks.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

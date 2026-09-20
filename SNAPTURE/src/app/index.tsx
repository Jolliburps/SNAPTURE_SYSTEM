import { CameraView, useCameraPermissions } from "expo-camera";
import { fetch as expoFetch } from "expo/fetch";
import Constants from "expo-constants";
import { File } from "expo-file-system";
import { type ChangeEvent, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Page = "camera" | "preview" | "result";

const API_PORT = 8000;
const FALLBACK_API_URL = "http://192.168.1.171:8000";

function hostFromAddress(address: string | null | undefined): string | null {
  if (!address?.trim()) {
    return null;
  }

  try {
    const candidate = address.includes("://")
      ? address
      : `http://${address}`;
    return new URL(candidate).hostname || null;
  } catch {
    return null;
  }
}

function inferDevelopmentHost(): string | null {
  // A browser already knows which computer served the Expo bundle. This
  // makes `http://<computer-ip>:8081` work from another device without
  // changing the API URL for each browser.
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const browserHost = window.location.hostname;
    if (browserHost && browserHost !== "0.0.0.0") {
      return browserHost;
    }
  }

  // Expo Go receives the development server host in the public config.
  // The debugger host is kept as a compatibility fallback for older manifests.
  return hostFromAddress(
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost
  );
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const developmentHost = inferDevelopmentHost();
const inferredApiUrl = developmentHost
  ? `http://${developmentHost}:${API_PORT}`
  : null;

// During local development, prefer the host that delivered the Expo bundle.
// For production/native builds, or when host discovery is unavailable, use
// the explicit EXPO_PUBLIC_API_URL value and finally the project fallback.
const API_BASE_URL = (
  (__DEV__ && inferredApiUrl
    ? inferredApiUrl
    : configuredApiUrl || inferredApiUrl || FALLBACK_API_URL)
).replace(/\/+$/, "");

type ApiResult = {
  label: string;
  model_class: string;
  confidence: number;
  title: string;
  preparation: string[];
  reuse_options: string[];
};

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const webFileInputRef = useRef<HTMLInputElement | null>(null);

  const [page, setPage] = useState<Page>("camera");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<ApiResult | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Browsers only expose getUserMedia (and therefore CameraView) to secure
  // contexts. `http://192.168.x.x:8081` is not secure, even on a private LAN,
  // so use the browser's file/camera picker there instead of a dead permission
  // button. `http://localhost:8081` and Expo Go continue to use live camera.
  const isInsecureWeb =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    !window.isSecureContext;

  const chooseWebPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow selecting the same file again after retaking it.
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Pumili ng image file para ma-analyze.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setErrorMessage("Hindi mabasa ang napiling larawan. Subukan muli.");
        return;
      }

      setPhotoUri(reader.result);
      setApiResult(null);
      setErrorMessage("");
      setPage("preview");
    };
    reader.onerror = () => {
      setErrorMessage("Hindi mabasa ang napiling larawan. Subukan muli.");
    };
    reader.readAsDataURL(file);
  };

  const takePhoto = async () => {
    if (!cameraRef.current || !cameraReady || busy) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo?.uri) {
        throw new Error("No photo was returned.");
      }

      setPhotoUri(photo.uri);
      setPage("preview");
    } catch (error) {
      console.error(error);
      setErrorMessage("Hindi makuha ang larawan. Subukan muli.");
    } finally {
      setBusy(false);
    }
  };

  const analyzePhoto = async () => {
    if (!photoUri || busy) {
      return;
    }

    setBusy(true);
    setErrorMessage("");

    try {
      // Expo SDK 57's fetch does not support React Native's legacy
      // `{ uri, name, type }` FormData part. File implements the native
      // `bytes()` interface that Expo's multipart encoder expects.
      const formData = new FormData();

      if (Platform.OS === "web") {
        // CameraView returns a blob/data URI in the browser. The native
        // expo-file-system File class is not used on web.
        const photoResponse = await fetch(photoUri);
        const photoBlob = await photoResponse.blob();
        formData.append("file", photoBlob, "scan.jpg");
      } else {
        const imageFile = new File(photoUri);
        formData.append("file", imageFile as any);
      }

      const response = await expoFetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.detail ?? "The local API returned an error.");
      }

      if (!payload?.label) {
        throw new Error("The local API returned an invalid result.");
      }

      setApiResult(payload as ApiResult);
      setPage("result");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Hindi makakonekta sa SNAPTURE model. Tiyaking naka-run ang API at pareho ang Wi-Fi ng phone at computer."
      );
    } finally {
      setBusy(false);
    }
  };

  const retakePhoto = () => {
    setPhotoUri(null);
    setApiResult(null);
    setErrorMessage("");
    setCameraReady(false);
    setPage("camera");
  };

  const finishResult = () => {
    setPhotoUri(null);
    setApiResult(null);
    setErrorMessage("");
    setCameraReady(false);
    setPage("camera");
  };

  if (isInsecureWeb && page === "camera") {
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>SNAPTURE</Text>

        <Text style={styles.permissionTitle}>
          Camera access needs a secure connection
        </Text>

        <Text style={styles.permissionText}>
          Hindi pinapagana ng browser ang live camera sa LAN HTTP address.
          Puwede pa ring kumuha o pumili ng larawan gamit ang button sa ibaba.
        </Text>

        {errorMessage ? (
          <Text style={styles.previewErrorText}>{errorMessage}</Text>
        ) : null}

        <Pressable
          style={styles.primaryButton}
          onPress={() => webFileInputRef.current?.click()}
        >
          <Text style={styles.primaryButtonText}>
            Choose / Take Photo
          </Text>
        </Pressable>

        <Text style={styles.permissionHint}>
          Para sa live camera preview, gamitin ang Expo Go o buksan ang app sa
          localhost/HTTPS.
        </Text>

        <input
          ref={webFileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={chooseWebPhoto}
          style={{ display: "none" }}
        />
      </View>
    );
  }

  if (page === "camera" && !permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#176b4d" />
        <Text style={styles.loadingText}>
          Checking camera permission...
        </Text>
      </View>
    );
  }

  if (page === "camera" && permission && !permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>SNAPTURE</Text>

        <Text style={styles.permissionTitle}>
          Camera access is needed
        </Text>

        <Text style={styles.permissionText}>
          Gagamitin ang camera para makakuha ng larawan ng household material.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={requestPermission}
        >
          <Text style={styles.primaryButtonText}>
            Allow Camera
          </Text>
        </Pressable>
      </View>
    );
  }

  if (page === "preview" && photoUri) {
    return (
      <View style={styles.previewPage}>
        <Image
          source={{ uri: photoUri }}
          style={styles.previewImage}
          resizeMode="contain"
        />

        <View style={styles.previewPanel}>
          <Text style={styles.panelTitle}>
            Review your photo
          </Text>

          <Text style={styles.panelText}>
            Siguraduhing malinaw at isang object lamang ang nasa larawan.
          </Text>

          {errorMessage ? (
            <Text style={[styles.errorText, styles.previewErrorText]}>
              {errorMessage}
            </Text>
          ) : null}

          <Pressable
            style={styles.primaryButton}
            onPress={analyzePhoto}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Analyze with SNAPTURE
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={retakePhoto}
          >
            <Text style={styles.secondaryButtonText}>
              Retake Photo
            </Text>
          </Pressable>

          <Text style={styles.demoNote}>
            The photo will be analyzed by your local SNAPTURE model.
          </Text>
        </View>
      </View>
    );
  }

  if (page === "result" && photoUri && apiResult) {
    const isUnknown = apiResult.label === "unknown_unsupported";

    return (
      <ScrollView
        style={styles.resultPage}
        contentContainerStyle={styles.resultContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.logo}>SNAPTURE</Text>

        <Text style={styles.demoLabel}>
          {isUnknown ? "UNIDENTIFIED / UNSUPPORTED" : "MODEL RESULT"}
        </Text>

        <Image
          source={{ uri: photoUri }}
          style={styles.resultImage}
          resizeMode="contain"
        />

        <View style={styles.resultCard}>
          <Text style={styles.resultHeading}>
            {apiResult.title}
          </Text>

          <Text style={styles.resultSubheading}>
            Model class: {apiResult.model_class} · Confidence: {Math.round(apiResult.confidence * 100)}%
          </Text>

          <Text style={styles.resultText}>
            Suggested preparation:
          </Text>

          {apiResult.preparation.map((step, index) => (
            <Text
              key={`${apiResult.label}-${index}`}
              style={styles.resultText}
            >
              {index + 1}. {step}
            </Text>
          ))}

          {apiResult.reuse_options.length > 0 ? (
            <>
              <Text style={styles.resultText}>
                Possible reuse/upcycling:
              </Text>

              {apiResult.reuse_options.map((option, index) => (
                <Text
                  key={`${apiResult.label}-reuse-${index}`}
                  style={styles.resultText}
                >
                  • {option}
                </Text>
              ))}
            </>
          ) : null}

          <Text style={styles.warningText}>
            {isUnknown
              ? "No reuse instructions are provided when the object is uncertain or unsupported."
              : "Educational decision support only. This result does not certify chemical, microbial, structural, or food-contact safety."}
          </Text>

          <Text style={styles.demoNote}>
            Result generated by the local SNAPTURE model.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={finishResult}
          >
            <Text style={styles.primaryButtonText}>
              Done / OK
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode="picture"
        onCameraReady={() => setCameraReady(true)}
        onMountError={(event) => {
          setErrorMessage(`Camera error: ${event.message}`);
        }}
      />

      <View style={styles.topOverlay} pointerEvents="none">
        <Text style={styles.logoWhite}>SNAPTURE</Text>

        <Text style={styles.instruction}>
          Scan one household material
        </Text>
      </View>

      <View style={styles.frameOverlay} pointerEvents="none">
        <View style={styles.scanFrame} />

        <Text style={styles.frameText}>
          Place the object inside the frame
        </Text>
      </View>

      <View style={styles.bottomPanel}>
        <Text style={styles.statusText}>
          {cameraReady
            ? "Ready to take a photo"
            : "Starting camera..."}
        </Text>

        {errorMessage ? (
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.captureButton,
            (!cameraReady || busy) &&
              styles.captureButtonDisabled,
          ]}
          onPress={takePhoto}
          disabled={!cameraReady || busy}
        >
          {busy ? (
            <ActivityIndicator
              color="#ffffff"
              size="large"
            />
          ) : (
            <View style={styles.captureButtonInner} />
          )}
        </Pressable>

        <Text style={styles.helpText}>
          Use good lighting and keep the object visible.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07131f",
  },

  camera: {
    flex: 1,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f4faf7",
  },

  loadingText: {
    marginTop: 12,
    color: "#456",
  },

  logo: {
    fontSize: 32,
    fontWeight: "800",
    color: "#176b4d",
    marginBottom: 24,
  },

  logoWhite: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
  },

  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#18352b",
    textAlign: "center",
    marginBottom: 10,
  },

  permissionText: {
    fontSize: 16,
    color: "#52655d",
    textAlign: "center",
    lineHeight: 23,
    marginBottom: 24,
  },

  permissionHint: {
    maxWidth: 420,
    color: "#6b7b73",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 16,
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#176b4d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    marginTop: 14,
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#176b4d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    marginTop: 12,
  },

  secondaryButtonText: {
    color: "#176b4d",
    fontSize: 16,
    fontWeight: "700",
  },

  topOverlay: {
    position: "absolute",
    top: 52,
    left: 24,
    right: 24,
  },

  instruction: {
    color: "#ffffff",
    fontSize: 16,
    marginTop: 6,
  },

  frameOverlay: {
    position: "absolute",
    top: "25%",
    left: 0,
    right: 0,
    alignItems: "center",
  },

  scanFrame: {
    width: "82%",
    height: 270,
    borderWidth: 3,
    borderColor: "#ffffff",
    borderRadius: 24,
  },

  frameText: {
    color: "#ffffff",
    fontSize: 15,
    marginTop: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 18,
    paddingBottom: 32,
    paddingHorizontal: 24,
    backgroundColor: "rgba(0,0,0,0.58)",
  },

  statusText: {
    color: "#ffffff",
    fontSize: 15,
    marginBottom: 12,
  },

  captureButton: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },

  captureButtonDisabled: {
    opacity: 0.5,
  },

  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
  },

  helpText: {
    color: "#dce9e4",
    fontSize: 13,
    marginTop: 14,
    textAlign: "center",
  },

  errorText: {
    color: "#ffb4a9",
    fontSize: 14,
    textAlign: "center",
    marginVertical: 8,
  },

  previewErrorText: {
    color: "#a43b2b",
  },

  previewPage: {
    flex: 1,
    backgroundColor: "#08151f",
  },

  previewImage: {
    flex: 1,
    width: "100%",
  },

  previewPanel: {
    padding: 22,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  panelTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#17352a",
  },

  panelText: {
    color: "#5a6b63",
    marginTop: 6,
    lineHeight: 21,
  },

  demoNote: {
    color: "#7a6a2f",
    fontSize: 12,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 18,
  },

  resultPage: {
    flex: 1,
    backgroundColor: "#f4faf7",
  },

  resultContent: {
    padding: 22,
    paddingBottom: 130,
  },

  demoLabel: {
    color: "#a27616",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 10,
  },

  resultImage: {
    width: "100%",
    height: 230,
    backgroundColor: "#dfeae5",
    borderRadius: 18,
  },

  resultCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    marginTop: 18,
  },

  resultHeading: {
    fontSize: 26,
    fontWeight: "800",
    color: "#176b4d",
  },

  resultSubheading: {
    color: "#6d7e75",
    marginTop: 4,
    marginBottom: 18,
  },

  resultText: {
    color: "#30453b",
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 3,
  },

  warningText: {
    color: "#8a6515",
    backgroundColor: "#fff7d6",
    padding: 12,
    borderRadius: 10,
    marginTop: 18,
    lineHeight: 19,
  },
});

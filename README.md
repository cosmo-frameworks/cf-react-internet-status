# cf-react-internet-status

## Installation

```
npm install cf-react-internet-status
```

## Example

Import and use the **InternetStatusProvider**, then you can use the hook **useInternetStatusContext**

```typescript
import {
  InternetStatusProvider,
  useInternetStatusContext,
} from "cf-react-internet-status";

function App() {
  const { isOnline } = useInternetStatusContext();

  return (
    <InternetStatusProvider>
      {isOnline ? (
        <p>You're connected to the internet.</p>
      ) : (
        <p>No internet connection.</p>
      )}
    </InternetStatusProvider>
  );
}

export default App;
```

You can also use the component **InternetStatus**

```typescript
import {
  InternetStatusProvider,
  InternetStatus,
} from "cf-react-internet-status";

function App() {
  return (
    <InternetStatusProvider>
      <InternetStatus/>
    </InternetStatusProvider>
  );
}

export default App;
```
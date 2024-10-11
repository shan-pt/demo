import { Buffer } from "buffer";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import React from "react";
import ReactDOM from "react-dom/client";
import { ToastContainer } from "react-toastify";
import { WagmiProvider } from "wagmi";
import App from "./App.tsx";
import { SwapUpdater } from "./components/SwapUpdater.tsx";
import { persister, queryClient } from "./lib/query-client.ts";
import { config } from "./wagmi.ts";

import "react-toastify/dist/ReactToastify.css";
import "./index.scss";
import { Query, defaultShouldDehydrateQuery } from "@tanstack/react-query";

globalThis.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 60 * 2 * 1000,
          dehydrateOptions: {
            shouldDehydrateQuery: (query: Query) => {
              if (defaultShouldDehydrateQuery(query) && query.queryHash.includes("useMarketOdds")) {
                return true;
              }
              return false;
            },
          },
        }}
      >
        <App />
        <SwapUpdater />
        <ToastContainer />
        <ReactQueryDevtools initialIsOpen={false} />
      </PersistQueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);

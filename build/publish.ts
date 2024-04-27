// Created on 2023/03/26 - 00:39
import { publish, refreshCDN } from "@moonvy/deploy"

await publish("web", "./dist", "aigc_prompt")
await refreshCDN(["https://moonvy.com/aigc_prompt/"])

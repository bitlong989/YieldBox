import { ContractFactory, ethers } from "ethers"
import { markRaw, reactive } from "vue"
import * as factories from "../../typechain-types"
import { BaseFactory } from "./FactoryInterface"
import { hardhat } from "./HardhatProvider"

interface IAddressInfo {
    address: string
    type: "wallet" | "contract" | "miner"
    name: string
    object: ethers.Wallet | null
}

type StepType = "deploy" | "attach" | "call"

interface IStep {
    type: StepType
    user: string
}

interface IDeployStep extends IStep {
    name: string
    factory: string
    args: any[]
}

interface IAttachStep extends IStep {
    name: string
    address: string
    abi: string
}

interface ICallStep extends IStep {
    contract: string
    method: string
    args: any[]
}

class Step {
    info: IStep
    script: Script

    constructor(info: IStep, script: Script) {
        this.info = info
        this.script = script
    }

    async run() {
        const signer = hardhat.getAccount(this.info.user)

        if (this.info.type == "deploy") {
            const deploy_info = this.info as IDeployStep
            // @ts-ignore
            const contract = await (new this.factories[deploy_info.factory](signer) as ContractFactory)
                .deploy(...deploy_info.args)
            await contract.deployed()

            this.script.contracts[deploy_info.name] = markRaw(contract)

            test.addresses[contract.address] = {
                address: contract.address,
                type: "contract",
                name: deploy_info.name,
                object: null
            }
        }

        if (this.info.type == "call") {
            const call_info = this.info as ICallStep
            const contract = this.script.contracts[call_info.contract]
            const tx = await contract.functions[call_info.method](...call_info.args)
        }

        test.save()
    }
}

class Script {
    steps: IStep[]
    contracts: { [name: string]: ethers.Contract } = reactive({})

    constructor(steps: IStep[]) {
        this.steps = reactive(steps)
    }

    async run() {
        for(let i in this.steps) {
            const step = new Step(this.steps[i], this)
            await step.run()
        }
    }

    async add(step_info: IStep) {
        this.steps.push(step_info)
        const step = new Step(step_info, this)
        await step.run()
    }
}

type FactoryName = keyof typeof factories

class TestManager {
    script: Script
    fixtureId: string = ""

    factories = {} as { [name: string]: typeof BaseFactory }
    addresses = {} as { [address: string]: IAddressInfo }
    names = {} as { [name: string]: string }

    constructor() {
        this.script = new Script([])
        for(let key in factories) {
            // Filter out interfaces. Only factories with bytecode, that are deployable.
            if(factories[key as FactoryName].hasOwnProperty("bytecode")) {
                // @ts-ignore
                this.factories[key.substring(0, key.length - 9)] = factories[key as FactoryName]
            }
        }
    }

    save() {
        window.localStorage.setItem("setup", JSON.stringify(this.script.steps))
    }

    // Creates a snapshot as the initial state for the EVM
    async init() {
        this.fixtureId = await hardhat.provider.send("evm_snapshot", [])
        console.log("Fixture created", this.fixtureId)
    }
    
    // Resets the EVM to the initial state and moves the timestamp to now
    async reset() {
        await hardhat.provider.send("evm_revert", [this.fixtureId])
        await hardhat.provider.send("evm_setNextBlockTimestamp", [Date.now() / 1000])
    }
}

let test: TestManager = new TestManager()

export {
    IDeployStep,
    IAttachStep,
    ICallStep,
    TestManager,
    test
}
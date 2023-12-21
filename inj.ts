import { getNetworkInfo, Network } from '@injectivelabs/networks'
import {
    PrivateKey,
    TxGrpcClient,
    ChainRestAuthApi,
    createTransaction,
    ChainRestTendermintApi,
} from '@injectivelabs/sdk-ts'
import { MsgSend } from '@injectivelabs/sdk-ts'
import { BigNumberInBase, DEFAULT_STD_FEE } from '@injectivelabs/utils'
import { endTime, pk, startTime, times } from './pk'

/** MsgSend Example */

const network = getNetworkInfo(Network.Mainnet)


const lcd = 'https://lcd-injective.keplr.app';
const txService = new TxGrpcClient('https://sentry.chain.grpc-web.injective.network:443')
const memo = 'ZGF0YToseyJwIjoiaW5qcmMtMjAiLCJvcCI6Im1pbnQiLCJ0aWNrIjoiSU5KUyIsImFtdCI6IjEwMDAifQ==';
async function start(pk: string, times: number) {
    const privateKey = PrivateKey.fromMnemonic(pk)
    const injectiveAddress = privateKey.toBech32()
    const publicKey = privateKey.toPublicKey().toBase64()
    const toAddress = 'inj166zrwnezgts7k4qugt9896j2n3m0gddj976qj4'

    /** Account Details **/
    const accountDetails = await new ChainRestAuthApi(lcd).fetchAccount(
        injectiveAddress,
    )

    // 记录nonce, 避免每次获取, rpc容易挂掉
    let initSequence = parseInt(accountDetails.account.base_account.sequence, 10);
    const accountNumber = parseInt(
        accountDetails.account.base_account.account_number,
        10,
    )

    /** Prepare the Message */
    const amount = {
        amount: new BigNumberInBase(0.00001).toWei().toFixed(),
        denom: 'inj',
    }

    const msg = MsgSend.fromJSON({
        amount,
        srcInjectiveAddress: injectiveAddress,
        dstInjectiveAddress: toAddress
    })

    const chainRestTendermintApi = new ChainRestTendermintApi(lcd)

    async function doIt() {
        const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
        if(Number(latestBlock.header.height) >= startTime){
            console.log('开始了')
        } else if (Number(latestBlock.header.height) >= endTime) {
            console.log('结束了')
            return
        }else {
            console.log(`当前：${latestBlock.header.height} 距离开始：${startTime - Number(latestBlock.header.height)}`)
            return doIt()
        }

       

        if (times <= 0) return console.log('打完了');

        /** Prepare the Transaction **/
        const { signBytes, txRaw } = createTransaction({
            message: msg,
            memo,
            fee: DEFAULT_STD_FEE,
            pubKey: publicKey,
            sequence: initSequence,
            accountNumber,
            chainId: network.chainId,
        })
        /** Sign transaction */
        const signature = await privateKey.sign(Buffer.from(signBytes)).catch(e => e)

        if (signature instanceof Error) return doIt()

        /** Append Signatures */
        txRaw.signatures = [signature]

        /** Broadcast transaction */
        const txResponse = await txService.broadcast(txRaw).catch(e => e)
        if (txResponse instanceof Error) {
            const accountDetails = await new ChainRestAuthApi(lcd).fetchAccount(
                injectiveAddress,
            )
            initSequence = parseInt(accountDetails.account.base_account.sequence, 10);
            return doIt()
        }

        console.log(
            `${times}::: ${injectiveAddress} | TX: ${JSON.stringify(txResponse.txHash)}`,
        )
        initSequence++;
        times--;
        doIt()
    }

    doIt()
}


start(pk, times);
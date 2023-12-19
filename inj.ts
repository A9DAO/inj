import { getNetworkInfo, Network } from '@injectivelabs/networks'
import {
    PrivateKey,
    TxGrpcClient,
    ChainRestAuthApi,
    createTransaction,
} from '@injectivelabs/sdk-ts'
import { MsgSend } from '@injectivelabs/sdk-ts'
import { BigNumberInBase, DEFAULT_STD_FEE } from '@injectivelabs/utils'
import { pk } from './pk'

/** MsgSend Example */

const network = getNetworkInfo(Network.Mainnet)

const lcd = 'https://lcd-injective.keplr.app';
const txService = new TxGrpcClient('https://sentry.chain.grpc-web.injective.network:443')
const memo = 'ZGF0YToseyJwIjoiaW5qcmMtMjAiLCJvcCI6Im1pbnQiLCJ0aWNrIjoiSU5KUyIsImFtdCI6IjIwMDAifQ==';
async function start(pk: string, times: number) {
    const privateKey = PrivateKey.fromMnemonic(pk)
    const injectiveAddress = privateKey.toBech32()
    const publicKey = privateKey.toPublicKey().toBase64()
    const toAddress = 'inj15jy9vzmyy63ql9y6dvned2kdat2994x5f4ldu4'

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
        amount: new BigNumberInBase(0.003).toWei().toFixed(),
        denom: 'inj',
    }

    const msg = MsgSend.fromJSON({
        amount,
        srcInjectiveAddress: injectiveAddress,
        dstInjectiveAddress: toAddress
    })

    async function doIt() {

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


start(pk, 1);
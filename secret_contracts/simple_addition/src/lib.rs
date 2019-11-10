// Rust’s standard library provides a lot of useful functionality,
// but WebAssembly does not support all of it.
// eng_wasm exposes a subset of std.
//#![no_std]

// The eng_wasm crate allows to use the Enigma runtime, which provides:
// manipulating state, creation of random, printing and more
extern crate eng_wasm;

// The eng_wasm_derive crate provides the following
//     - Functions exposed by the contract that may be called from the Enigma network
//     - Ability to call functions of ethereum contracts from ESC
extern crate eng_wasm_derive;
extern crate enigma_crypto;
extern crate rustc_hex;
//use eng_wasm::*;

// For contract-exposed functions first include:
//use eng_wasm_derive::pub_interface;
use eng_wasm::*;
use eng_wasm::{String, Vec, H160, H256, U256, eprint, decrypt, generate_key, SymmetricKey};
use eng_wasm_derive::eth_contract;
use eng_wasm_derive::pub_interface;
use enigma_crypto::hash::Keccak256;
use enigma_crypto::KeyPair;
use rustc_hex::ToHex;

#[eth_contract("Sample.json")]
struct EthContract;

// State key name "wizard_eth_address" holding eth address of Mixer contract
static WIZARD_ETH_ADDR: &str = "wizard_eth_addr";
static ENCRYPTION_KEY: &str = "encryption_key";
// For contract-exposed functions, declare such functions under the following public trait:
#[pub_interface]
trait ContractInterface{
    
    fn get_pub_key() -> Vec<u8>;
    fn construct(wizard_eth_address: H160);
    fn commit_to_duel( MoveSet1:Vec<u8>,
            MoveSet2:Vec<u8>,
            wizard1:U256,
            wizard2:U256,
            affinities:Vec<u8>);
}

// The implementation of the exported ESC functions should be defined in the trait implementation 
// for a new struct. 
 struct Contract;
impl Contract{
 fn get_wizard_eth_address() -> String {
        read_state!(WIZARD_ETH_ADDR).unwrap_or_default()
    }

    fn get_pkey() -> SymmetricKey {
        let key = read_state!(ENCRYPTION_KEY).unwrap();
        eprint!("Got key: {:?}", key);
        key
    }

    fn get_keypair() -> KeyPair {
        let key = Self::get_pkey();
        KeyPair::from_slice(&key).unwrap()
    }
    fn ValidArray(a:Vec<u8>)->bool{
            let mut RetVal=true;
            for x in &a {
        
                if x>&2{
                    RetVal=false;
                    break;
                }
            
            }
            RetVal 
        }
    fn duel_score(m1:Vec<u8>,m2:Vec<u8>,af1:u8,af2:u8)->i128{
        let Weights:Vec<u8>=[78,79,81,86,100].to_vec();
        let mut score:i128=0;
        for n in 0..m1.len(){
            let t=m1[n] as i8;
            let t1=m2[n] as i8;
            let mut diff:i128=(t-t1) as i128;
            if(&diff*&diff==4){
                diff = -(diff >> 1);
            }
            diff=diff*100;
            if (&m1[n] == &af1) {
                diff = diff * 130 / 100;
            }
            if (&m1[n] == &af2) {
                diff = diff * 130 / 100;
            }
            score=score+diff*(Weights[n] as i128);
        }
        score=score/100;
        score
    }
    
}

impl ContractInterface for Contract {
     fn construct(wizard_eth_address: H160) {
        let wizard_eth_address_str: String = wizard_eth_address.to_hex();
        write_state!(WIZARD_ETH_ADDR => wizard_eth_address_str);

        // Create new random encryption key
        let key = generate_key();
        write_state!(ENCRYPTION_KEY => key);
    }

    fn get_pub_key() -> Vec<u8> {
        let keypair = Self::get_keypair();
        let pub_key = keypair.get_pubkey();
        let pub_key_text: String = pub_key.to_hex();
        eprint!("The pubKey hex: {}", pub_key_text);
        pub_key.to_vec()
    }
    fn commit_to_duel( MoveSet1:Vec<u8>,
            MoveSet2:Vec<u8>,
            wizard1:U256,
            wizard2:U256,
            affinities:Vec<u8>,
            ){
        let temp:u8=affinities[0];
        let temp2:u8=affinities[1];     
        let score=Self::duel_score(MoveSet1,MoveSet2,temp,temp2);
        let mut negative=false;
        if score<0{
            negative=true;
        }
        let Score= U256::from(score);
        let wizard_eth_addr: String = Self::get_wizard_eth_address();
        let prefixed_eth_addr = format!("0x{}",wizard_eth_addr);
        let eth_contract = EthContract::new(&prefixed_eth_addr);
        eth_contract.ResolveDuel(Score,negative, wizard1,wizard2);

    }
    
}

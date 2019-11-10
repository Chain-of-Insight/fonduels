#include <stdbool.h>

#define SYMMETRIC_KEY_SIZE 256 / 8

/**
 * This enum is used to return from an ecall/ocall to represent if the operation was a success and if not then what was the error.
 * The goal is to not reveal anything sensitive
 * `#[repr(C)]` is a Rust feature which makes the struct be aligned just like C structs.
 * See [`Repr(C)`][https://doc.rust-lang.org/nomicon/other-reprs.html]
 */
typedef enum {
  /**
   * Success, the function returned without any failure.
   */
  Success,
  /**
   * TaskFailure, the task(Deploy/Compute) has failed
   */
  TaskFailure,
  /**
   * KeysError, There's a key missing or failed to derive a key.
   */
  KeysError,
  /**
   * Failure in Encryption, couldn't decrypt the variable / failed to encrypt the results.
   */
  EncryptionError,
  /**
   * SigningError, for some reason it failed on signing the results.
   */
  SigningError,
  /**
   * RecoveringError, Something failed in recovering the public key.
   */
  RecoveringError,
  /**
   * PermissionError, Received a permission error from an ocall, (i.e. opening the signing keys file or something like that)
   */
  PermissionError,
  /**
   * SgxError, Error that came from the SGX specific stuff (i.e DRAND, Sealing etc.)
   */
  SgxError,
  /**
   * StateError, an Error in the State. (i.e. failed applying delta, failed deserializing it etc.)
   */
  StateError,
  /**
   * OcallError, an error from an ocall.
   */
  OcallError,
  /**
   * OcallDBError, an error from the Database in the untrusted part, couldn't get/save something.
   */
  OcallDBError,
  /**
   * MessagingError, a message that received couldn't be processed (i.e. KM Message, User Key Exchange etc.)
   */
  MessagingError,
  /**
   * WorkerAuthError, Failed to authenticate the worker, this is specific to the KM node.
   */
  WorkerAuthError,
  /**
   * Missing StateKeys in the KM node.
   */
  KeyProvisionError,
  /**
   * Something went really wrong.
   */
  Other,
} EnclaveReturn;

/**
 * This struct is basically some sort of a boolean that says if an operation was a success or a failure.
 */
typedef enum {
  /**
   * Ok = Success = 1.
   */
  Ok = 1,
  /**
   * Failure = Error = 0.
   */
  Failure = 0,
} ResultStatus;

/**
 * This struct is what returned from a Deploy/Compute ecall, it contains all the needed data.
 */
typedef struct {
  /**
   * A pointer to the output of the execution using [`ocall_save_to_memory`](../replace_me) (on the untrusted stack)
   */
  const uint8_t *output;
  /**
   * A pointer to the resulting delta using [`ocall_save_to_memory`](../replace_me) (on the untrusted stack)
   */
  const uint8_t *delta_ptr;
  /**
   * The delta index number.
   */
  uint32_t delta_index;
  /**
   * A pointer to the Ethereum payload using [`ocall_save_to_memory`](../replace_me) (on the untrusted stack)
   */
  const uint8_t *ethereum_payload_ptr;
  /**
   * The ethereum address that the payload belongs to.
   */
  uint8_t ethereum_address[20];
  /**
   * A signature by the enclave on all of the results.
   */
  uint8_t signature[65];
  /**
   * The gas used by the execution.
   */
  uint64_t used_gas;
} ExecuteResult;

/**
 * This struct is basically a wrapper over `[u8; 32]`, and is meant to be returned from whatever hashing functions we use.
 * `#[repr(C)]` is a Rust feature which makes the struct be aligned just like C structs.
 * See [`Repr(C)`][https://doc.rust-lang.org/nomicon/other-reprs.html]
 */
typedef struct {
  uint8_t _0[32];
} Hash256;

/**
 * symmetric key we use for encryption.
 */
typedef uint8_t SymmetricKey[SYMMETRIC_KEY_SIZE];

/**
 * StateKey is the key used for state encryption.
 */
typedef SymmetricKey StateKey;

/**
 * ContractAddress is the address of contracts in the Enigma Network.
 */
typedef Hash256 ContractAddress;

/**
 * PubKey is a public key that is used for ECDSA signing.
 */
typedef uint8_t PubKey[64];

/**
 * This struct is a wrapper to a raw pointer.
 * when you pass a pointer through the SGX bridge(EDL) the SGX Edger8r will copy the data that it's pointing to
 * using `memalloc` and `memset` to the other side of the bridge, then it changes the pointer to point to the new data.
 * So this struct is needed if you want to pass a pointer from one side to the other while the pointer still points to the right locaiton.
 * Say you want to give the enclave a DB on the untrusted, so that the enclave can then pass that pointer to an ocall.
 * This will let you do it without the Edger8r messing with the pointer.
 * And I tried to add a mutability bool to make it a little more safe by giving you a pointer based on the original mutability.
 */
typedef struct {
  const uint8_t *ptr;
  bool _mut;
} RawPointer;

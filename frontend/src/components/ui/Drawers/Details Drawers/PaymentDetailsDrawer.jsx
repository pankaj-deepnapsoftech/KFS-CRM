import { useState, useEffect } from "react";
import { BiX } from "react-icons/bi";
import {toast} from 'react-toastify';
import Loading from "../../Loading";
import {useCookies} from 'react-cookie';

const PaymentDetailsDrawer = ({dataId: id, closeDrawerHandler})=>{
    const [cookies] = useCookies();
  const [isLoading, setIsLoading] = useState(true);
  const [details, setDetails] = useState({});

  const fetchPaymentDetails = async () => {
    try {
      const baseUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(baseUrl + "payment/payment-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cookies?.access_token}`,
        },
        body: JSON.stringify({
          paymentId: id,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      setDetails({
        invoicename: data.payment?.invoice.invoicename,
        id: data.payment?._id,
        amount: data.payment?.amount,
        mode: data.payment?.mode,
        createdByName: data.payment?.createdBy.name,
        createdByDesignation: data.payment?.createdBy.designation,
        createdByPhone: data.payment?.createdBy.phone,
        description: data.payment?.description,
        reference: data.payment?.reference,
      });

      setIsLoading(false);
      toast.success(data.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    fetchPaymentDetails(id);
  }, []);

    return (
        <div
      className="absolute overflow-auto h-[100vh] w-[90vw] md:w-[450px] bg-white right-0 top-0 z-10 py-3"
      style={{
        boxShadow:
          "rgba(0, 0, 0, 0.08) 0px 6px 16px 0px, rgba(0, 0, 0, 0.12) 0px 3px 6px -4px, rgba(0, 0, 0, 0.05) 0px 9px 28px 8px",
      }}
    >
      <h1 className="px-4 flex gap-x-2 items-center text-xl py-3 border-b">
        <BiX onClick={closeDrawerHandler} size="26px" />
        Payment
      </h1>

      <div className="mt-8 px-5">
        <h2 className="text-2xl font-semibold py-5 text-center mb-6 border-y bg-[#f9fafc]">
          Payment for invoice #{details?.invoicename}
        </h2>

        {isLoading && <Loading />}
        {!isLoading && (
          <div>
            <div className="mt-3 mb-5 font-bold">
              <p>Payment Id</p>
              <p className="font-normal">{details?.id}</p>
            </div>
            <div className="mt-3 mb-5 font-bold">
              <p>Amount</p>
              <p className="font-normal">&#8377;{details?.amount}</p>
            </div>
            <div className="mt-3 mb-5 font-bold">
              <p>Mode</p>
              <p className="font-normal">{details?.mode}</p>
            </div>
            <div className="mt-3 mb-5 font-bold">
              <p>Created By (Name)</p>
              <p className="font-normal">{details?.createdByName}</p>
            </div>
            <div className="mt-3 mb-5 font-bold">
              <p>Created By (Designation)</p>
              <p className="font-normal">{details?.createdByDesignation}</p>
            </div>
            <div className="mt-3 mb-5 font-bold">
              <p>Created By (Phone)</p>
              <p className="font-normal">{details?.createdByPhone}</p>
            </div>
            <div className="mt-3 mb-5 font-bold">
              <p>Description</p>
              <p className="font-normal">{details?.description}</p>
            </div>
            <div className="mt-3 mb-5 font-bold">
              <p>Reference</p>
              <p className="font-normal">{details?.reference}</p>
            </div>
          </div>
        )}
      </div>
    </div>
    )
}

export default PaymentDetailsDrawer;
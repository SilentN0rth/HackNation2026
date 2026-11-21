import { TextField as TextField_797f95c17514f9bdcb08951fd39f801c } from '@/payload/admin/fields/TextField'
import { SelectField as SelectField_2da25264c6e0228afb99864125928eff } from '@/payload/admin/fields/SelectField'
import { DocumentRoot as DocumentRoot_b02337ca5d246afd142bb532989d7f07 } from '@/payload/admin/collections/DocumentRoot'
import { ListView as ListView_476d1b646075ee0f093482b6978f9aff } from '@/payload/admin/collections/ListView'
import { SegmentedSelectField as SegmentedSelectField_2da25264c6e0228afb99864125928eff } from '@/payload/admin/fields/SelectField'
import { UploadField as UploadField_46a14ce77a751fc702c5b97d6042c543 } from '@/payload/admin/fields/UploadField'
import { TextareaField as TextareaField_797f95c17514f9bdcb08951fd39f801c } from '@/payload/admin/fields/TextField'
import { NumberField as NumberField_da90cba38b64830242e24a4c565b2226 } from '@/payload/admin/fields/NumberField'
import { JSONField as JSONField_cd5792a9bd9ccd3c1b6ffcc5a8870b3b } from '@/payload/admin/fields/JSONField'
import { DateField as DateField_6015cd4fbe7d848e3aac64676dd21a00 } from '@/payload/admin/fields/DateField'
import { RelationshipField as RelationshipField_c42156fb661f0de1aa87a7027301843e } from '@/payload/admin/fields/RelationshipField'
import { FormDocLinks as FormDocLinks_86ba2847848c7f45a95186043150a3c1 } from '@/payload/admin/views/FormDocLinks'
import { AuditList as AuditList_2bc4e5744dc8878a8ee4dbd9fa2227ca } from '@/payload/admin/views/AuditList'
import { SwitchField as SwitchField_5c27863c85c704ccfa57979d5d66cc42 } from '@/payload/admin/fields/CheckboxField'
import { Avatar as Avatar_96cd1ec30b700a05cc6247c4f2dc0d75 } from '@/payload/plugins/admin-ui/shell/Avatar'
import { Nav as Nav_2df1345f77509fb205f294a4b0a361a3 } from '@/payload/plugins/admin-ui/shell/Nav'
import { LogoutButton as LogoutButton_2f8982916f291ff7dec39e687071ae2b } from '@/payload/plugins/admin-ui/shell/LogoutButton'
import { Icon as Icon_63c02d0bce2c6e8ceb4c857bf607b039 } from '@/payload/plugins/admin-ui/shell/Logo'
import { Logo as Logo_63c02d0bce2c6e8ceb4c857bf607b039 } from '@/payload/plugins/admin-ui/shell/Logo'
import { NavLinks as NavLinks_243ef96d780ce3032a4159f1a604fe84 } from '@/payload/admin/views/NavLinks'
import { Providers as Providers_9398890bfcd08d7dfc0e55b4952f2400 } from '@/payload/plugins/admin-ui/theme/Providers'
import { LoginView as LoginView_8cd57156b65a73f783423f2e9ab477e9 } from '@/payload/plugins/admin-ui/views/Login'
import { CreateFirstUserView as CreateFirstUserView_0fd9ad33d11d518f4f3f2cef24a34708 } from '@/payload/plugins/admin-ui/views/CreateFirstUser'
import { ForgotPasswordView as ForgotPasswordView_86e085f4b11f8d8dc7b1d92ea1a4aab5 } from '@/payload/plugins/admin-ui/views/ForgotPassword'
import { AccountView as AccountView_b85aa409e1936d8d923326716f9a549c } from '@/payload/plugins/admin-ui/views/Account'
import { LogoutView as LogoutView_31db9c2c6a83e1289849d91fc4d00e3f } from '@/payload/plugins/admin-ui/views/Logout'
import { LogoutInactivityView as LogoutInactivityView_31db9c2c6a83e1289849d91fc4d00e3f } from '@/payload/plugins/admin-ui/views/Logout'
import { UnauthorizedView as UnauthorizedView_6a4d161ddcd5eb41bb9bcb58282af1ce } from '@/payload/plugins/admin-ui/views/Unauthorized'
import { Dashboard as Dashboard_d4c469e9c7cc32f1d53c65ddb6f0fd0e } from '@/payload/admin/views/Dashboard'
import { Upload as Upload_a0c0b573dfbd68117853ce259582d159 } from '@/payload/admin/views/Upload'
import { FormEditor as FormEditor_2d0d0c17b7c408e2de9ded9f4d33e5cf } from '@/payload/admin/views/FormEditor'
import { Audit as Audit_5714c2c13953f7e1c281ad07175863f7 } from '@/payload/admin/views/Audit'
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from '@payloadcms/next/rsc'

/** @type import('payload').ImportMap */
export const importMap = {
  "@/payload/admin/fields/TextField#TextField": TextField_797f95c17514f9bdcb08951fd39f801c,
  "@/payload/admin/fields/SelectField#SelectField": SelectField_2da25264c6e0228afb99864125928eff,
  "@/payload/admin/collections/DocumentRoot#DocumentRoot": DocumentRoot_b02337ca5d246afd142bb532989d7f07,
  "@/payload/admin/collections/ListView#ListView": ListView_476d1b646075ee0f093482b6978f9aff,
  "@/payload/admin/fields/SelectField#SegmentedSelectField": SegmentedSelectField_2da25264c6e0228afb99864125928eff,
  "@/payload/admin/fields/UploadField#UploadField": UploadField_46a14ce77a751fc702c5b97d6042c543,
  "@/payload/admin/fields/TextField#TextareaField": TextareaField_797f95c17514f9bdcb08951fd39f801c,
  "@/payload/admin/fields/NumberField#NumberField": NumberField_da90cba38b64830242e24a4c565b2226,
  "@/payload/admin/fields/JSONField#JSONField": JSONField_cd5792a9bd9ccd3c1b6ffcc5a8870b3b,
  "@/payload/admin/fields/DateField#DateField": DateField_6015cd4fbe7d848e3aac64676dd21a00,
  "@/payload/admin/fields/RelationshipField#RelationshipField": RelationshipField_c42156fb661f0de1aa87a7027301843e,
  "@/payload/admin/views/FormDocLinks#FormDocLinks": FormDocLinks_86ba2847848c7f45a95186043150a3c1,
  "@/payload/admin/views/AuditList#AuditList": AuditList_2bc4e5744dc8878a8ee4dbd9fa2227ca,
  "@/payload/admin/fields/CheckboxField#SwitchField": SwitchField_5c27863c85c704ccfa57979d5d66cc42,
  "@/payload/plugins/admin-ui/shell/Avatar#Avatar": Avatar_96cd1ec30b700a05cc6247c4f2dc0d75,
  "@/payload/plugins/admin-ui/shell/Nav#Nav": Nav_2df1345f77509fb205f294a4b0a361a3,
  "@/payload/plugins/admin-ui/shell/LogoutButton#LogoutButton": LogoutButton_2f8982916f291ff7dec39e687071ae2b,
  "@/payload/plugins/admin-ui/shell/Logo#Icon": Icon_63c02d0bce2c6e8ceb4c857bf607b039,
  "@/payload/plugins/admin-ui/shell/Logo#Logo": Logo_63c02d0bce2c6e8ceb4c857bf607b039,
  "@/payload/admin/views/NavLinks#NavLinks": NavLinks_243ef96d780ce3032a4159f1a604fe84,
  "@/payload/plugins/admin-ui/theme/Providers#Providers": Providers_9398890bfcd08d7dfc0e55b4952f2400,
  "@/payload/plugins/admin-ui/views/Login#LoginView": LoginView_8cd57156b65a73f783423f2e9ab477e9,
  "@/payload/plugins/admin-ui/views/CreateFirstUser#CreateFirstUserView": CreateFirstUserView_0fd9ad33d11d518f4f3f2cef24a34708,
  "@/payload/plugins/admin-ui/views/ForgotPassword#ForgotPasswordView": ForgotPasswordView_86e085f4b11f8d8dc7b1d92ea1a4aab5,
  "@/payload/plugins/admin-ui/views/Account#AccountView": AccountView_b85aa409e1936d8d923326716f9a549c,
  "@/payload/plugins/admin-ui/views/Logout#LogoutView": LogoutView_31db9c2c6a83e1289849d91fc4d00e3f,
  "@/payload/plugins/admin-ui/views/Logout#LogoutInactivityView": LogoutInactivityView_31db9c2c6a83e1289849d91fc4d00e3f,
  "@/payload/plugins/admin-ui/views/Unauthorized#UnauthorizedView": UnauthorizedView_6a4d161ddcd5eb41bb9bcb58282af1ce,
  "@/payload/admin/views/Dashboard#Dashboard": Dashboard_d4c469e9c7cc32f1d53c65ddb6f0fd0e,
  "@/payload/admin/views/Upload#Upload": Upload_a0c0b573dfbd68117853ce259582d159,
  "@/payload/admin/views/FormEditor#FormEditor": FormEditor_2d0d0c17b7c408e2de9ded9f4d33e5cf,
  "@/payload/admin/views/Audit#Audit": Audit_5714c2c13953f7e1c281ad07175863f7,
  "@payloadcms/next/rsc#CollectionCards": CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1
}
